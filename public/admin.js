 document.addEventListener('DOMContentLoaded', () => {
            const loginContainer = document.getElementById('loginContainer');
            const loginForm = document.getElementById('loginForm');
            const loginFeedback = document.getElementById('loginFeedback');
            const adminContainer = document.getElementById('adminContainer');
            const adminPanel = document.getElementById('adminPanel');
            const carForm = document.getElementById('carForm');
            const carsList = document.getElementById('carsList');
            const feedbackMessage = document.getElementById('feedbackMessage');
            const API_URL = '/api/cars';
            const LOGIN_API_URL = '/api/login';

            if (!loginForm || !loginFeedback || !adminContainer || !adminPanel || !carForm || !carsList || !feedbackMessage) {
                console.error('Required elements not found in DOM');
                return;
            }

            // Fetch CSRF token
            async function getCsrfToken() {
                try {
                    const response = await fetch('/api/csrf-token', { credentials: 'include' });
                    if (!response.ok) throw new Error('Failed to fetch CSRF token');
                    const { csrfToken } = await response.json();
                    return csrfToken;
                } catch (error) {
                    console.error('Error fetching CSRF token:', error);
                    showLoginFeedback('Error: Unable to fetch CSRF token', 'error');
                    return null;
                }
            }

            // Handle login form submission
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value.trim();
                const password = document.getElementById('password').value;

                if (!username || !password) {
                    showLoginFeedback('Please enter both username and password.', 'error');
                    return;
                }

                try {
                    const csrfToken = await getCsrfToken();
                    if (!csrfToken) return;

                    const response = await fetch(LOGIN_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include',
                        body: JSON.stringify({ username, password })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Login failed: ${errorText}`);
                    }

                    const result = await response.json();
                    loginContainer.style.display = 'none';
                    adminContainer.style.display = 'block';
                    adminPanel.style.display = 'block';
                    initAdmin();
                    showLoginFeedback('Login successful!', 'success');
                } catch (error) {
                    console.error('Login error:', error);
                    showLoginFeedback('Error: Invalid credentials or server error', 'error');
                }
            });

            function logout() {
                loginContainer.style.display = 'block';
                adminContainer.style.display = 'none';
                adminPanel.style.display = 'none';
                loginForm.reset();
                carsList.innerHTML = '';
                showLoginFeedback('Logged out successfully.', 'success');
            }

            function initAdmin() {
                renderAdminCarList();
                setupAdminEventListeners();
            }

            function setupAdminEventListeners() {
                carForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const editId = carForm.dataset.editId;
                    if (editId) {
                        await updateCar(parseInt(editId));
                    } else {
                        await addNewCar();
                    }
                });
            }

            async function renderAdminCarList() {
                try {
                    const csrfToken = await getCsrfToken();
                    if (!csrfToken) return;

                    const response = await fetch(API_URL, {
                        headers: {
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include'
                    });
                    if (!response.ok) {
                        throw new Error('Failed to fetch cars');
                    }
                    const cars = await response.json();
                    carsList.innerHTML = '';

                    cars.forEach(car => {
                        const carItem = document.createElement('div');
                        carItem.className = 'car-list-item';
                        carItem.innerHTML = `
                            <div class="car-list-info">
                                <h4>${DOMPurify.sanitize(car.name)}</h4>
                                <p>Ksh${DOMPurify.sanitize(car.price.toLocaleString())} | ${DOMPurify.sanitize(car.brand)}</p>
                            </div>
                            <div class="car-list-actions">
                                <button class="btn btn-primary edit-btn" data-car-id="${car.id}">Edit</button>
                                <button class="btn btn-danger delete-btn" data-car-id="${car.id}">Delete</button>
                            </div>
                        `;
                        carsList.appendChild(carItem);
                    });

                    document.querySelectorAll('.edit-btn').forEach(button => {
                        button.addEventListener('click', () => {
                            const carId = parseInt(button.getAttribute('data-car-id'));
                            editCar(carId);
                        });
                    });

                    document.querySelectorAll('.delete-btn').forEach(button => {
                        button.addEventListener('click', () => {
                            const carId = parseInt(button.getAttribute('data-car-id'));
                            deleteCar(carId);
                        });
                    });
                } catch (error) {
                    console.error('Error fetching cars:', error);
                    carsList.innerHTML = '<p class="text-center">Error loading cars.</p>';
                    if (error.message.includes('401') || error.message.includes('403')) {
                        logout();
                    }
                }
            }

            async function addNewCar() {
                const formData = new FormData();
                const requiredFields = {
                    name: document.getElementById('carName').value.trim(),
                    brand: document.getElementById('carBrand').value,
                    price: document.getElementById('carPrice').value,
                    mileage: document.getElementById('carMileage').value.trim(),
                    year: document.getElementById('carYear').value,
                    color: document.getElementById('carColor').value.trim(),
                    transmission: document.getElementById('carTransmission').value,
                    fuelType: document.getElementById('carFuelType').value,
                    location: document.getElementById('carLocation').value.trim(),
                    engine: document.getElementById('carEngine').value.trim(),
                    description: document.getElementById('carDescription').value.trim(),
                    phone: document.getElementById('sellerPhone').value.trim()
                };

                for (let field in requiredFields) {
                    if (!requiredFields[field]) {
                        showFeedback(`Please fill in the ${field.replace('car', '').replace('seller', 'seller ').toLowerCase()} field.`, 'error');
                        return;
                    }
                    formData.append(field, requiredFields[field]);
                }

                const imageFiles = document.getElementById('carImages').files;
                if (imageFiles.length > 10) {
                    showFeedback('Please select up to 10 images only.', 'error');
                    return;
                }

                if (imageFiles.length > 0) {
                    for (let file of imageFiles) {
                        if (file.size > 5 * 1024 * 1024) {
                            showFeedback(`Image ${file.name} exceeds 5MB limit. Please compress it.`, 'error');
                            return;
                        }
                        formData.append('images', file);
                    }
                } else {
                    showFeedback('Please upload at least one image.', 'error');
                    return;
                }

                try {
                    const csrfToken = await getCsrfToken();
                    if (!csrfToken) return;

                    showFeedback('Uploading car...', 'info');
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: {
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include',
                        body: formData
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }

                    const result = await response.json();
                    showFeedback('Car added successfully!', 'success');
                    carForm.reset();
                    await renderAdminCarList();
                } catch (error) {
                    console.error('Error adding car:', error);
                    showFeedback('Error adding car: Server error', 'error');
                    if (error.message.includes('401') || error.message.includes('403')) {
                        logout();
                    }
                }
            }

            async function editCar(carId) {
                try {
                    const csrfToken = await getCsrfToken();
                    if (!csrfToken) return;

                    const response = await fetch(`${API_URL}/${carId}`, {
                        headers: {
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include'
                    });
                    if (!response.ok) {
                        throw new Error('Failed to fetch car data');
                    }
                    const car = await response.json();

                    document.getElementById('carName').value = car.name;
                    document.getElementById('carBrand').value = car.brand;
                    document.getElementById('carPrice').value = car.price;
                    document.getElementById('carMileage').value = car.mileage;
                    document.getElementById('carYear').value = car.year;
                    document.getElementById('carColor').value = car.color;
                    document.getElementById('carTransmission').value = car.transmission;
                    document.getElementById('carFuelType').value = car.fuelType;
                    document.getElementById('carLocation').value = car.location;
                    document.getElementById('carEngine').value = car.engine;
                    document.getElementById('carDescription').value = car.description;
                    document.getElementById('sellerPhone').value = car.phone;

                    carForm.dataset.editId = carId;
                    carForm.querySelector('button[type="submit"]').textContent = 'Update Car';
                } catch (error) {
                    console.error('Error fetching car for edit:', error);
                    showFeedback('Error loading car data', 'error');
                    if (error.message.includes('401') || error.message.includes('403')) {
                        logout();
                    }
                }
            }

            async function updateCar(carId) {
                const formData = new FormData();
                formData.append('name', document.getElementById('carName').value);
                formData.append('brand', document.getElementById('carBrand').value);
                formData.append('price', document.getElementById('carPrice').value);
                formData.append('mileage', document.getElementById('carMileage').value);
                formData.append('year', document.getElementById('carYear').value);
                formData.append('color', document.getElementById('carColor').value);
                formData.append('transmission', document.getElementById('carTransmission').value);
                formData.append('fuelType', document.getElementById('carFuelType').value);
                formData.append('location', document.getElementById('carLocation').value);
                formData.append('engine', document.getElementById('carEngine').value);
                formData.append('description', document.getElementById('carDescription').value);
                formData.append('phone', document.getElementById('sellerPhone').value);
                const imageFiles = document.getElementById('carImages').files;
                if (imageFiles.length > 0) {
                    for (let file of imageFiles) {
                        formData.append('images', file);
                    }
                }

                try {
                    const csrfToken = await getCsrfToken();
                    if (!csrfToken) return;

                    const response = await fetch(`${API_URL}/${carId}`, {
                        method: 'PUT',
                        headers: {
                            'CSRF-Token': csrfToken
                        },
                        credentials: 'include',
                        body: formData
                    });
                    if (response.ok) {
                        showFeedback('Car updated successfully!', 'success');
                        carForm.reset();
                        carForm.querySelector('button[type="submit"]').textContent = 'Add Car';
                        carForm.removeAttribute('data-editId');
                        await renderAdminCarList();
                    } else {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }
                } catch (error) {
                    console.error('Error updating car:', error);
                    showFeedback('Error updating car: Server error', 'error');
                    if (error.message.includes('401') || error.message.includes('403')) {
                        logout();
                    }
                }
            }

            async function deleteCar(carId) {
                if (confirm('Are you sure you want to delete this car?')) {
                    try {
                        const csrfToken = await getCsrfToken();
                        if (!csrfToken) return;

                        const response = await fetch(`${API_URL}/${carId}`, {
                            method: 'DELETE',
                            headers: {
                                'CSRF-Token': csrfToken
                            },
                            credentials: 'include'
                        });
                        if (response.ok) {
                            showFeedback('Car deleted successfully!', 'success');
                            await renderAdminCarList();
                        } else {
                            const errorText = await response.text();
                            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                        }
                    } catch (error) {
                        console.error('Error deleting car:', error);
                        showFeedback('Error deleting car: Server error', 'error');
                        if (error.message.includes('401') || error.message.includes('403')) {
                            logout();
                        }
                    }
                }
            }

            function showFeedback(message, type) {
                feedbackMessage.textContent = DOMPurify.sanitize(message);
                feedbackMessage.className = `feedback-message ${type}`;
                setTimeout(() => {
                    feedbackMessage.className = 'feedback-message';
                    feedbackMessage.textContent = '';
                }, 5000);
            }

            function showLoginFeedback(message, type) {
                loginFeedback.textContent = DOMPurify.sanitize(message);
                loginFeedback.className = `feedback-message ${type}`;
                setTimeout(() => {
                    loginFeedback.className = 'feedback-message';
                    loginFeedback.textContent = '';
                }, 5000);
            }
        });