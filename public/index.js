const mainContent = document.getElementById('mainContent');
const carListing = document.getElementById('carListing');
const priceDropdown = document.getElementById('priceDropdown');
const brandDropdown = document.getElementById('brandDropdown');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navMenu = document.getElementById('navMenu');
const homeLink = document.getElementById('homeLink');
const carsLink = document.getElementById('carsLink');
const contactLink = document.getElementById('contactLink');

let selectedBrand = 'All';
const API_URL = '/api/cars';

function init() {
  carListing.classList.remove('hidden');
  renderCarListings();
  setupEventListeners();
}

function setupEventListeners() {
  priceDropdown.addEventListener('change', renderCarListings);
  brandDropdown.addEventListener('change', () => {
    selectedBrand = brandDropdown.value;
    renderCarListings();
  });

  hamburgerBtn.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });

  homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    carListing.classList.remove('hidden');
    renderCarListings();
    navMenu.classList.remove('active');
  });

  carsLink.addEventListener('click', (e) => {
    e.preventDefault();
    carListing.classList.remove('hidden');
    renderCarListings();
    navMenu.classList.remove('active');
  });

  contactLink.addEventListener('click', (e) => {
            // Remove e.preventDefault() to allow navigation
            if (navMenu) {
                navMenu.classList.remove('active');
            }
            // Optionally remove alert if not needed
            // alert('Contact us at: info@autoelite.com');
        });
}

async function renderCarListings() {
  const maxPrice = parseInt(priceDropdown.value);

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, text: ${await response.text()}`);
    }
    const cars = await response.json();
    carListing.innerHTML = '';

    const filteredCars = cars.filter(car => {
      const price = car.price;
      return (
        (selectedBrand === 'All' || car.brand === selectedBrand) &&
        (maxPrice === 10000000 || // All Prices
         (maxPrice === 1000000 && price < 1000000) || // Less than 1M
         (maxPrice === 2000000 && price >= 1000000 && price < 2000000) || // 1M - 2M
         (maxPrice === 3000000 && price >= 2000000 && price < 3000000) || // 2M - 3M
         (maxPrice === 4000000 && price >= 3000000 && price < 4000000) || // 3M - 4M
         (maxPrice === 5000000 && price >= 4000000 && price < 5000000) || // 4M - 5M
         (maxPrice === 6000000 && price >= 5000000)) // More than 5M
      );
    });

    if (filteredCars.length === 0) {
      carListing.innerHTML = '<p class="text-center">No cars match your filters. Try adjusting your criteria.</p>';
      return;
    }

    filteredCars.forEach(car => {
      const carCard = document.createElement('div');
      carCard.className = 'car-card';
      const shortDescription = car.description.length > 120 ? car.description.substring(0, 120) + '...' : car.description;
      carCard.innerHTML = `
        <img src="${car.images[0]}" alt="${car.name}" class="car-image">
        <div class="car-details">
          <h3 class="car-title">${car.name}</h3>
          <div class="car-price">Ksh${car.price.toLocaleString()}</div>
          <div class="car-specs">
            <div class="car-spec"><i class="fas fa-tachometer-alt"></i> ${car.mileage}</div>
            <div class="car-spec"><i class="fas fa-calendar-alt"></i> ${car.year}</div>
            <div class="car-spec"><i class="fas fa-car"></i> ${car.brand}</div>
            <div class="car-spec"><i class="fas fa-road"></i> ${car.transmission}</div>
          </div>
          <p class="car-description">${shortDescription}</p>
          <a href="/car/${car.id}" class="view-btn">View Details</a>
        </div>
      `;
      carListing.appendChild(carCard);
    });
  } catch (error) {
    console.error('Error fetching cars:', error);
    carListing.innerHTML = '<p class="text-center">Error loading cars. Please try again later.</p>';
  }
}

init();