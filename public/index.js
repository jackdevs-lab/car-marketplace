const mainContent = document.getElementById('mainContent');
const carListing = document.getElementById('carListing');
const carDetailView = document.getElementById('carDetailView');
const backToList = document.getElementById('backToList');
const priceDropdown = document.getElementById('priceDropdown');
const brandGrid = document.querySelector('.brand-grid');
const homeLink = document.getElementById('homeLink');
const carsLink = document.getElementById('carsLink');
const contactLink = document.getElementById('contactLink');
const detailCarImage = document.getElementById('detailCarImage');
const sliderPrev = document.querySelector('.slider-prev');
const sliderNext = document.querySelector('.slider-next');
const sliderContainer = document.querySelector('.slider-container');

let selectedBrand = 'All';
let currentImageIndex = 0;
let currentCarId = null;
const API_URL = '/api/cars';

function init() {
  carListing.classList.remove('hidden');
  renderCarListings();
  setupEventListeners();
}

function setupEventListeners() {
  priceDropdown.addEventListener('change', renderCarListings);

  brandGrid.querySelectorAll('.brand-card').forEach(card => {
    if (card.dataset.brand === 'All') {
      card.classList.add('selected');
    }
    card.addEventListener('click', () => {
      brandGrid.querySelectorAll('.brand-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedBrand = card.dataset.brand;
      renderCarListings();
    });
  });

  backToList.addEventListener('click', () => {
    carDetailView.classList.add('hidden');
    carListing.classList.remove('hidden');
    renderCarListings();
  });

  homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    carDetailView.classList.add('hidden');
    carListing.classList.remove('hidden');
    renderCarListings();
  });

  carsLink.addEventListener('click', (e) => {
    e.preventDefault();
    carDetailView.classList.add('hidden');
    carListing.classList.remove('hidden');
    renderCarListings();
  });

  contactLink.addEventListener('click', (e) => {
    e.preventDefault();
    carDetailView.classList.add('hidden');
    carListing.classList.remove('hidden');
    alert('Contact us at: info@autoelite.com');
  });

  sliderPrev.addEventListener('click', () => {
    changeImage(-1);
  });

  sliderNext.addEventListener('click', () => {
    changeImage(1);
  });

  let touchStartX = null;
  let touchEndX = null;

  sliderContainer.addEventListener('touchstart', handleTouchStart, false);
  sliderContainer.addEventListener('touchmove', handleTouchMove, false);
  sliderContainer.addEventListener('touchend', handleTouchEnd, false);

  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
  }

  function handleTouchMove(e) {
    if (!touchStartX) return;
    touchEndX = e.touches[0].clientX;
  }

  function handleTouchEnd() {
    if (!touchStartX || !touchEndX) return;
    const touchDiff = touchEndX - touchStartX;
    if (touchDiff > 50) {
      changeImage(-1);
    } else if (touchDiff < -50) {
      changeImage(1);
    }
    touchStartX = null;
    touchEndX = null;
  }
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

    const filteredCars = cars.filter(car =>
      car.price <= maxPrice &&
      (selectedBrand === 'All' || car.brand === selectedBrand)
    );

    if (filteredCars.length === 0) {
      carListing.innerHTML = '<p class="text-center">No cars match your filters. Try adjusting your criteria.</p>';
      return;
    }

    filteredCars.forEach(car => {
      const carCard = document.createElement('div');
      carCard.className = 'car-card';
      carCard.innerHTML = `
        <img src="${car.images[0]}" alt="${car.name}" class="car-image">
        <div class="car-details">
          <h3 class="car-title">${car.name}</h3>
          <div class="car-price">$${car.price.toLocaleString()}</div>
          <div class="car-specs">
            <div class="car-spec"><i class="fas fa-tachometer-alt"></i> ${car.mileage}</div>
            <div class="car-spec"><i class="fas fa-calendar-alt"></i> ${car.year}</div>
            <div class="car-spec"><i class="fas fa-car"></i> ${car.brand}</div>
          </div>
          <p class="car-description">${car.description.substring(0, 100)}...</p>
          <a href="#" class="view-btn" data-car-id="${car.id}">View Details</a>
        </div>
      `;
      carListing.appendChild(carCard);
    });

    document.querySelectorAll('.view-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const carId = parseInt(button.getAttribute('data-car-id'));
        showCarDetail(carId);
      });
    });
  } catch (error) {
    console.error('Error fetching cars:', error);
    carListing.innerHTML = '<p class="text-center">Error loading cars. Please try again later.</p>';
  }
}

async function showCarDetail(carId) {
  try {
    const response = await fetch(`${API_URL}/${carId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, text: ${await response.text()}`);
    }
    const car = await response.json();

    currentCarId = carId;
    document.querySelector('.car-name').textContent = car.name;
    document.querySelector('.detail-price').textContent = `$${car.price.toLocaleString()}`;
    document.getElementById('detailBrand').textContent = car.brand;
    document.getElementById('detailYear').textContent = car.year;
    document.getElementById('detailDescription').textContent = car.description;
    document.getElementById('detailMileage').textContent = car.mileage;
    document.getElementById('detailColor').textContent = car.color;
    document.getElementById('detailTransmission').textContent = car.transmission;
    document.getElementById('detailEngine').textContent = car.engine;
    document.getElementById('sellerPhone').textContent = car.phone;

    currentImageIndex = 0;
    detailCarImage.src = car.images[currentImageIndex] || '';
    carDetailView.classList.remove('hidden');
    carListing.classList.add('hidden');
  } catch (error) {
    console.error('Error fetching car details:', error);
    alert('Error loading car details');
  }
}

function changeImage(direction) {
  if (!currentCarId || !detailCarImage) return;
  fetch(`${API_URL}/${currentCarId}`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(car => {
      const totalImages = car.images.length;
      if (totalImages === 0) {
        detailCarImage.src = '';
        return;
      }
      currentImageIndex = (currentImageIndex + direction + totalImages) % totalImages;
      detailCarImage.src = car.images[currentImageIndex] || '';
    })
    .catch(error => {
      console.error('Error fetching images:', error);
      detailCarImage.src = '';
    });
}

init();