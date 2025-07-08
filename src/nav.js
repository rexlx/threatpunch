const burger = document.getElementById('burger');
const burgerNavBar = document.getElementById('nav-links');

// Add a click event on the burger icon
burger.addEventListener('click', () => {
    burgerNavBar.classList.toggle('is-active');
});