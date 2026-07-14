// app.js

// 1. Datos iniciales (Luego los conectaremos con localStorage)
const bizData = {
    saldo: 3000000,
    compromisos: 2500000,
    saldoAyer: 3200000 
};

// 2. Motor de lógica (El que diseñamos antes)
function calcularSaludNegocio() {
    let excedente = bizData.saldo - bizData.compromisos;
    let tendencia = bizData.saldo - bizData.saldoAyer;
    
    let estado = "verde";
    let mensaje = "🚀 ¡Excelente! Tu negocio está estable.";

    if (excedente < 0) {
        estado = "rojo";
        mensaje = "⚠️ ¡Alerta! No tienes suficiente efectivo para tus compromisos. Prioriza pagos.";
    } else if (tendencia < 0 && excedente < (bizData.compromisos * 0.2)) {
        estado = "amarillo";
        mensaje = "📉 Tus gastos superan tus ingresos. Ajusta los costos antes de entrar en crisis.";
    }

    return { estado, mensaje };
}

// 3. Función para pintar el resultado en tu web
function actualizarDashboard() {
    const salud = calcularSaludNegocio();
    
    // Aquí actualizas el mensaje en tu "Asesor IA"
    const asesorBody = document.getElementById('asesorBody');
    if (asesorBody) {
        asesorBody.innerHTML = `<div class="asesor-msg bot"><div class="bubble">${salud.mensaje}</div></div>`;
    }
}

// 4. Ejecutar al cargar la página
window.onload = () => {
    actualizarDashboard();
};

console.log("¡Conexión establecida con éxito!");