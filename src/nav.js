const burger = document.getElementById('burger');
const burgerNavBar = document.getElementById('nav-links');


burger.addEventListener('click', () => {
    burgerNavBar.classList.toggle('is-active');
});