document.addEventListener('DOMContentLoaded', async () => {
    const carId = window.location.pathname.split('/').pop();
    const API_URL = '/api/cars';
    let images = [];
    let currentIndex = 0;

    const carImageContainer = document.getElementById('carImageContainer');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    try {
        const response = await fetch(`${API_URL}/${carId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const car = await response.json();
        const sanitize = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize : (text) => text || 'N/A';
        document.getElementById('carName').textContent = car.name || 'N/A';
        document.getElementById('carTransmission').textContent = car.transmission || 'N/A';
        document.getElementById('carMileage').textContent = car.mileage || 'N/A';
        document.getElementById('carFuelType').textContent = car.fuelType || 'N/A';
        document.getElementById('carLocation').textContent = car.location || 'N/A';
        document.getElementById('carPrice').textContent = car.price ? `Ksh${car.price.toLocaleString()}` : 'N/A';
        document.getElementById('carColor').textContent = car.color || 'N/A';
        document.getElementById('carYear').textContent = car.year || 'N/A';
        document.getElementById('carEngine').textContent = car.engine || 'N/A';
        document.getElementById('carDescription').textContent = DOMPurify.sanitize(car.description || 'N/A');
        document.getElementById('carPhone').textContent = car.phone || 'N/A';

        images = car.images || [];
        if (images.length === 0) {
            carImageContainer.innerHTML = '<p>No images available</p>';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            return;
        }

        images.forEach((src, index) => {
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Car Image ${index + 1}`;
            img.className = 'car-image';
            carImageContainer.appendChild(img);
        });

        carImageContainer.style.width = `${images.length * 100}%`;
        updateSlider();

        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            updateSlider();
        });

        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % images.length;
            updateSlider();
        });

        carImageContainer.querySelectorAll('.car-image').forEach(img => {
            img.addEventListener('click', () => {
                const fullscreenDiv = document.createElement('div');
                fullscreenDiv.className = 'fullscreen-image';
                fullscreenDiv.innerHTML = `
                    <div class="fullscreen-image-container">
                        <span class="close-fullscreen">×</span>
                        <button class="fullscreen-slider-btn prev">❮</button>
                        <img src="${images[currentIndex]}" alt="Car Image">
                        <button class="fullscreen-slider-btn next">❯</button>
                    </div>
                `;
                document.body.appendChild(fullscreenDiv);

                const fullscreenImg = fullscreenDiv.querySelector('img');
                const fullscreenPrevBtn = fullscreenDiv.querySelector('.fullscreen-slider-btn.prev');
                const fullscreenNextBtn = fullscreenDiv.querySelector('.fullscreen-slider-btn.next');

                fullscreenPrevBtn.addEventListener('click', () => {
                    currentIndex = (currentIndex - 1 + images.length) % images.length;
                    fullscreenImg.src = images[currentIndex];
                });

                fullscreenNextBtn.addEventListener('click', () => {
                    currentIndex = (currentIndex + 1) % images.length;
                    fullscreenImg.src = images[currentIndex];
                });

                fullscreenDiv.querySelector('.close-fullscreen').addEventListener('click', () => {
                    fullscreenDiv.remove();
                });
            });
        });

        function updateSlider() {
            const offset = -currentIndex * (100 / images.length);
            carImageContainer.style.transform = `translateX(${offset}%)`;
        }
    } catch (error) {
        console.error('Error fetching car details:', error);
        document.getElementById('carDetails').innerHTML = `<li style="color: red;">Error loading car details: ${error.message}</li>`;
    }
});