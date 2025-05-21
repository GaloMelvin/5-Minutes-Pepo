document.addEventListener('DOMContentLoaded', function() {
    const btnIniciar = document.getElementById('btnIniciar');
    const btnSalir = document.getElementById('btnSalir');

    btnIniciar.addEventListener('click', function() {
        window.location.href = '/HTML/juego.html';
    });
});
document.addEventListener('DOMContentLoaded', function() {
    const btnPersonajes = document.getElementById('btnPersonajes');
    const btnSalir = document.getElementById('btnSalir');

    btnPersonajes.addEventListener('click', function() {
        window.location.href = '/HTML/personajes.html';
    });
});
document.addEventListener('DOMContentLoaded', function() {
    const btnLimite = document.getElementById('btnLimite');
    const btnSalir = document.getElementById('btnSalir');

    btnLimite.addEventListener('click', function() {
        window.location.href = '/HTML/infinito.html';
    });
});
