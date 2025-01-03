// Function to convert CSV data to JSON
function csvToJson(csv) {
    var lines = csv.split("\n");
    var result = [];
    var headers = lines[0].split(",").map(header => header.trim());

    for (var i = 1; i < lines.length; i++) {
        var obj = {};
        var currentline = lines[i].split(",").map(cell => cell.trim());
        
        for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j];
        }
        result.push(obj);
    }
    return result;
}

let currentMarkers = [];
let continentMarkers = [];
let currentContinentMarker = null;
let map;
let meteorCounts = {}; // Initialize as an empty object

const iconMapping = {
    'Stony': 'dark.png',
    'Iron': 'metal.png',
    'Stony-Iron': 'multi.png',
    'Chondrite': 'meteor.png',
    'Achondrite': 'red.png',
    'Others': 'volcanic.png'
};

function loadCSVData(continentName) {
    fetch('classified_meteorites_cleaned.csv')
        .then(response => response.text())
        .then(csvText => {
            const data = csvToJson(csvText);
            if (continentName) {
                const filteredData = data.filter(meteor => meteor.continent === continentName);
                addAllMeteoriteMarkers(filteredData);
            } else {
                addAllMeteoriteMarkers(data);
            }
        })
        .catch(error => {
            console.error('Error loading the CSV file:', error);
        });
}

function addAllMeteoriteMarkers(data) {
    clearMarkers();

    const infoWindow = new google.maps.InfoWindow();

    data.forEach(meteor => {
        const position = new google.maps.LatLng(parseFloat(meteor.reclat), parseFloat(meteor.reclong));
        const iconFile = getIconForRecclass(meteor.recclass);

        const marker = new google.maps.Marker({
            position: position,
            map: map,
            icon: iconFile,
            title: meteor.meteorite_name,
            meteorType: getMeteorType(meteor.recclass)
        });

        marker.addListener('click', () => {
        const contentString = createInfoWindowContent(meteor);
        infoWindow.setContent(contentString);
        infoWindow.open(map, marker);

        // Additional logic to calculate and set the size of the meteorite image
        if(meteor["mass (g)"]) {
            const meteoriteImageSize = calculateMeteoriteSize(meteor["mass (g)"]);
            // You would then apply this size to the image element within the info window content
            // Note: This assumes you have an <img> tag with id="meteoriteImage" in the contentString
            const meteoriteImage = document.querySelector('#infoWindow img#meteoriteImage');
            if (meteoriteImage) {
                meteoriteImage.style.width = `${meteoriteImageSize}px`;
                meteoriteImage.style.height = `${meteoriteImageSize}px`;
            }
        }
    });

        currentMarkers.push(marker);
    });
}

function clearMarkers() {
    // Clear only meteorite markers, not continent markers
    currentMarkers.forEach(marker => marker.setMap(null));
    currentMarkers = [];
}

function createInfoWindowContent(meteor) {
    let comparisonImageHtml;
    const personWeightKg = 70; // Average weight of an adult person in kg
    const carWeightKg = 1500; // Average weight of a standard car in kg

    if (meteor["mass (g)"]) {
        if (meteor["mass (g)"] < 1500) {
            // If the meteorite is lighter than an average person
            comparisonImageHtml = '<img src="human.png" alt="Person" style="height: 170px;">';
        } else {
            // If the meteorite is heavier than an average person
            comparisonImageHtml = '<img src="car.png" alt="Car" style="width: 450px;">';
        }

        // Placeholder for the meteorite image element with mass
        var meteoriteImageHtml = `<img id="meteoriteImage" src="comparison.png" alt="Meteorite" style="width: ${calculateMeteoriteSize(meteor["mass (g)"])}px;">`;
    } else {
        // Handle the case where mass data is not available
        comparisonImageHtml = '<p>No comparison available due to unknown mass.</p>';
        var meteoriteImageHtml = ''; // No image if mass is unknown
    }

    return `
        <div>
            <h3>${meteor.meteorite_name}</h3>
            <p>Class: ${meteor.recclass}</p>
            <p>Mass: ${meteor["mass (g)"] ? meteor["mass (g)"] + ' grams' : 'Not available'}</p>
            <div style="display: flex; align-items: flex-end;">
                ${comparisonImageHtml}
                ${meteoriteImageHtml}
            </div>
            <p>Fall: ${meteor.fall}</p>
            <p>Year: ${meteor.year ? new Date(meteor.year).getFullYear() : 'Unknown'}</p>
            <p>Lat: ${meteor.reclat}, Long: ${meteor.reclong}</p>
        </div>
    `;
}



function calculateMeteoriteSize(massInGrams) {
    // Define a scaling factor
    const scaleFactor = 0.1; // This means 1 gram = 0.1 pixels

    // Calculate the size directly based on mass
    const size = massInGrams * scaleFactor;

    return size; // No caps on min or max sizes
}

function getMeteorType(recclass) {
    let type;

    if (/^L|^LL|^H(?!ow).*/i.test(recclass) && !recclass.includes("Iron")) {
        type = 'Stony';
    } else if (recclass.includes("Iron") || recclass.startsWith("I")) {
        type = 'Iron';
    } else if (recclass.includes("Mesosiderite") || recclass.includes("Pallasite")) {
        type = 'Stony-Iron';
    } else if (recclass.includes("Chondrite") && !recclass.includes("Achondrite")) {
        type = 'Chondrite';
    } else if (recclass.includes("Achondrite") || recclass.includes("Eucrite") || recclass.includes("Howardite")) {
        type = 'Achondrite';
    } else {
        type = 'Others';
    }

    return type;
}

function getIconForRecclass(recclass) {
    // Logic to determine the icon based on recclass
    return iconMapping[getMeteorType(recclass)];
}

function applyFilters() {
    const filterStatus = getFilterStatuses();

    fetch('classified_meteorites_cleaned.csv')
        .then(response => response.text())
        .then(csvText => {
            const data = csvToJson(csvText);
            const filteredData = data.filter(meteor => meteor.recclass && shouldMeteorBeVisible(meteor, filterStatus));

            meteorCounts = calculateMeteorCounts(filteredData);

            // Only reset continent markers if no continent is currently selected
            if (!currentContinentMarker) {
                setContinentMarkers();
            }

            // Apply visibility filters to current markers
            currentMarkers.forEach(marker => {
                const isVisible = shouldMarkerBeVisible(marker, filterStatus);
                marker.setVisible(isVisible);
            });
        })
        .catch(error => {
            console.error('Error loading the CSV file:', error);
        });
}


function calculateMeteorCounts(data) {
    const counts = {
        'Africa': 0,
        'Asia': 0,
        'Europe': 0,
        'North America': 0,
        'South America': 0,
        'Antarctica': 0,
        'Oceania': 0
    };

    data.forEach(meteor => {
        if (counts[meteor.continent] !== undefined) {
            counts[meteor.continent]++;
        }
    });

    return counts;
}

function shouldMeteorBeVisible(meteor, filterStatus) {
    const type = getMeteorType(meteor.recclass);
    return (
        (filterStatus.isStonyVisible && type === 'Stony') ||
        (filterStatus.isIronVisible && type === 'Iron') ||
        (filterStatus.isStonyIronVisible && type === 'Stony-Iron') ||
        (filterStatus.isChondriteVisible && type === 'Chondrite') ||
        (filterStatus.isAchondriteVisible && type === 'Achondrite') ||
        (filterStatus.isOthersVisible && type === 'Others')
    );
}
function getFilterStatuses() {
    return {
        isStonyVisible: document.getElementById('stony').checked,
        isIronVisible: document.getElementById('iron').checked,
        isStonyIronVisible: document.getElementById('stony-iron').checked,
        isChondriteVisible: document.getElementById('chondrite').checked,
        isAchondriteVisible: document.getElementById('achondrite').checked,
        isOthersVisible: document.getElementById('others').checked
    };
}

function shouldMarkerBeVisible(marker, filterStatus) {
    if (!marker.meteorType) {
        return false;
    }

    return (
        (filterStatus.isStonyVisible && marker.meteorType === 'Stony') ||
        (filterStatus.isIronVisible && marker.meteorType === 'Iron') ||
        (filterStatus.isStonyIronVisible && marker.meteorType === 'Stony-Iron') ||
        (filterStatus.isChondriteVisible && marker.meteorType === 'Chondrite') ||
        (filterStatus.isAchondriteVisible && marker.meteorType === 'Achondrite') ||
        (filterStatus.isOthersVisible && marker.meteorType === 'Others')
    );
}

// Check if the current page is "map.html" before adding the event listener
if (window.location.href.endsWith("map.html")) {
    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('apply-filters').addEventListener('click', applyFilters);
    });
}


// Functions for map initialization and continent marker setup (to be added)
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 0, lng: 0 },
        zoom: 2
    });

    // Initialize continent markers
    calculateInitialMeteorCounts().then(() => {
        setContinentMarkers();
    });

    // Initialize the legend
    const legend = document.getElementById('legend');
    const legendContent = [
        { name: "Stony", icon: "dark.png" },
        { name: "Iron", icon: "metal.png" },
        { name: "Stony-Iron", icon: "multi.png" },
        { name: "Chondrite", icon: "meteor.png" },
        { name: "Achondrite", icon: "red.png" },
        { name: "Other", icon: "volcanic.png" }
    ];

    // Populate the legend with icons and names
    legendContent.forEach(type => {
        const div = document.createElement('div');
        div.innerHTML = `<img src="${type.icon}" alt="${type.name} Icon" width="20"> ${type.name}`;
        legend.appendChild(div);
    });

    // Add the legend to the map
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(legend);

    // Optionally, load all meteorite data initially
    // loadCSVData();
}


function calculateInitialMeteorCounts() {
    return fetch('classified_meteorites_cleaned.csv')
        .then(response => response.text())
        .then(csvText => {
            const data = csvToJson(csvText);
            meteorCounts = calculateMeteorCounts(data); // Update global meteorCounts
            setContinentMarkers(); // Set markers with initial meteor counts
        })
        .catch(error => {
            console.error('Error loading the CSV file:', error);
        });
}

function setContinentMarkers() {
    continentMarkers.forEach(marker => marker.setMap(null));
    continentMarkers = [];

    const continents = [
        { name: 'Africa', lat: 10.0, lng: 20.0 },
        { name: 'Asia', lat: 24.0, lng: 80.0 },
        { name: 'Europe', lat: 58.0, lng: 75.0 },
        { name: 'North America', lat: 43.0, lng: -105.0 },
        { name: 'South America', lat: -20.0, lng: -55.0 },
        { name: 'Antarctica', lat: -80.0, lng: 30.0 },
        { name: 'Oceania', lat: -30.0, lng: 135.0 }
    ];

    continents.forEach(continent => {
        const count = meteorCounts[continent.name];
        const markerSize = calculateMarkerSize(count);

        const marker = new google.maps.Marker({
            position: { lat: continent.lat, lng: continent.lng },
            map: map,
            title: continent.name,
            icon: {
                url: 'continent.png', // Replace with your icon for continent
                scaledSize: new google.maps.Size(markerSize, markerSize)
            },
            continentName: continent.name // Add this property to identify the marker
        });

        marker.addListener('click', () => {
            zoomToContinent(continent, marker);
        });

        continentMarkers.push(marker);
    });
}

function zoomToContinent(continent, clickedMarker) {
    if (currentContinentMarker && currentContinentMarker !== clickedMarker) {
        currentContinentMarker.setMap(map);
    }

    map.setCenter({ lat: continent.lat, lng: continent.lng });
    map.setZoom(5); // Adjust zoom level as needed

    clickedMarker.setMap(null);
    currentContinentMarker = clickedMarker;

    // Apply current filters to the selected continent
    applyFiltersForContinent(continent.name);
}

function applyFiltersForContinent(continentName) {
    const filterStatus = getFilterStatuses();

    fetch('classified_meteorites_cleaned.csv')
        .then(response => response.text())
        .then(csvText => {
            const data = csvToJson(csvText);
            const filteredData = data.filter(meteor => 
                meteor.recclass && 
                shouldMeteorBeVisible(meteor, filterStatus) &&
                meteor.continent === continentName);

            // Clear existing markers and add new filtered markers
            clearMarkers();
            addAllMeteoriteMarkers(filteredData);
        })
        .catch(error => {
            console.error('Error loading the CSV file:', error);
        });
}


function calculateMarkerSize(count) {
    // Implement your logic to determine the marker size based on count
    // Example: return 20 + (count / 1000); // Adjust this formula as needed
	const baseSize = 40; // Increased base size for visibility
    const scaleFactor = 1.2; // Increased scale factor for larger sizes
	
    const scaledSize = Math.sqrt(count) * scaleFactor;
    return Math.max(baseSize, scaledSize);
}

function resetMap() {
    if (currentContinentMarker) {
        currentContinentMarker.setMap(map); // Make the current continent marker visible
        currentContinentMarker = null; // Reset current continent marker
    }

    map.setCenter({ lat: 0, lng: 0 });
    map.setZoom(2); // Reset zoom level

    clearMarkers(); // Clear existing meteorite markers
    resetFilters(); // Reset filters and reapply them
    setContinentMarkers(); // Re-add continent markers
}

function resetFilters() {
    // Reset filter checkboxes to their default state (e.g., all checked)
    document.getElementById('stony').checked = true;
    document.getElementById('iron').checked = true;
    document.getElementById('stony-iron').checked = true;
    document.getElementById('chondrite').checked = true;
    document.getElementById('achondrite').checked = true;
    document.getElementById('others').checked = true;

    // Reapply filters
    applyFilters();
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('meteorite-table')) {
	const rowsPerPage = 100;
	let currentPage = 1;
	let data = []; // Define the data array to store parsed CSV data
	const tableBody = document.getElementById('meteorite-data');
	const prevPageButton = document.getElementById('prev-page');
	const nextPageButton = document.getElementById('next-page');
	const pageNum = document.getElementById('page-num');

	// Fetch and parse the CSV data
	fetch('classified_meteorites_cleaned.csv')
		.then(response => response.text())
		.then(csvData => {
			data = parseCSV(csvData); // Parse CSV into an array
			updateTable(); // Initial table update
		})
		.catch(error => console.error('Error fetching and parsing the CSV data:', error));

	// Function to parse CSV data into an array
	function parseCSV(csvData) {
		// Parse the CSV data and return an array of rows
		const rows = csvData.split('\n');
		const parsedData = [];
		rows.forEach((row, index) => {
			if (index === 0 || row.trim() === '') return; // Skip header or empty row

			// Handling potential CSV complexity
			const columns = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);

			if (columns) {
				const rowData = columns.map(col => col.replace(/^"|"$/g, '')); // Remove quotes if present
				parsedData.push(rowData);
			}
		});
		return parsedData;
	}

	// Function to update the table content based on the current page
	function updateTable() {
		// Calculate the start and end index of rows to display
		const startIndex = (currentPage - 1) * rowsPerPage;
		const endIndex = currentPage * rowsPerPage;

		// Clear the table body
		tableBody.innerHTML = '';

		// Populate the table with rows within the current page range
		for (let i = startIndex; i < endIndex && i < data.length; i++) {
			const row = data[i];
			const rowElement = document.createElement('tr');
			row.forEach(col => {
				const cell = document.createElement('td');
				cell.textContent = col;
				rowElement.appendChild(cell);
			});
			tableBody.appendChild(rowElement);
		}

		// Update the page number display
		pageNum.textContent = `Page ${currentPage}`;
	}

	prevPageButton.addEventListener('click', prevPage);
    nextPageButton.addEventListener('click', nextPage);

	// Function to go to the previous page
	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
			updateTable();
		}
	}

	// Function to go to the next page
	function nextPage() {
		const totalPages = Math.ceil(data.length / rowsPerPage);
		if (currentPage < totalPages) {
			currentPage++;
			updateTable();
		}
	}

	// Initial table update
updateTable();
    }
});