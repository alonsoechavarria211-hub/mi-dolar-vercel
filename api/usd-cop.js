// api/usd-cop.js
export default async function handler(req, res) {
  try {
    const range = req.query.range || '1M'; // 1D, 1W, 1M, 1Y

    // 1. Definir cuántos días hacia atrás consultar para el período actual
    let daysBack = 30;
    if (range === '1D') daysBack = 2;
    if (range === '1W') daysBack = 7;
    if (range === '1M') daysBack = 30;
    if (range === '1Y') daysBack = 365;

    // Consultar rango actual (limitamos datos suficientes)
    const limitCurrent = Math.max(daysBack + 5, 30);
    const urlCurrent = `https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=${limitCurrent}&$order=vigenciadesde%20DESC`;
    
    const respCurrent = await fetch(urlCurrent);
    const dataCurrentRaw = await respCurrent.json();
    const sortedCurrent = dataCurrentRaw.reverse();

    // Mapear puntos actuales
    const pointsCurrent = sortedCurrent.map((item) => {
      const d = new Date(item.vigenciadesde);
      return {
        t: d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
        v: parseFloat(item.valor),
        fullDate: item.vigenciadesde
      };
    }).slice(-daysBack);

    // 2. Traer el período del año pasado (YoY)
    // Para simplificar la API abierta, tomamos una ventana equivalente desplaza ~365 días
    const limitYoY = limitCurrent + 365;
    const urlYoY = `https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=${limitYoY}&$order=vigenciadesde%20DESC`;
    
    const respYoY = await fetch(urlYoY);
    const dataYoYRaw = await respYoY.json();
    const sortedYoY = dataYoYRaw.reverse();

    // Filtramos los datos de hace 1 año (entre 365 días y 365 + daysBack atrás)
    const pointsYoY = sortedYoY.slice(0, sortedYoY.length - 365).slice(-daysBack).map((item) => {
      const d = new Date(item.vigenciadesde);
      return {
        t: d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
        v: parseFloat(item.valor)
      };
    });

    const threshold = pointsCurrent.length > 0 ? pointsCurrent[0].v : 3500;
    const currentSpot = pointsCurrent[pointsCurrent.length - 1]?.v || 0;
    const lastYearSpot = pointsYoY[pointsYoY.length - 1]?.v || currentSpot;
    const yoyDiff = currentSpot - lastYearSpot;
    const yoyPct = lastYearSpot ? ((yoyDiff / lastYearSpot) * 100).toFixed(2) : 0;

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=900');
    return res.status(200).json({
      range,
      threshold,
      currentSpot,
      lastYearSpot,
      yoyDiff,
      yoyPct,
      pointsCurrent,
      pointsYoY
    });

  } catch (error) {
    return res.status(500).json({ error: 'Error al consultar la TRM' });
  }
}
