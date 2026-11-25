// api/usd-cop.js
export default async function handler(req, res) {
  try {
    const range = req.query.range || '1M'; // 1D, 1W, 1M, 1Y

    // 1. Determinar fechas exactas (Hoy es Noviembre 2026)
    const now = new Date();
    const daysMap = { '1D': 2, '1W': 7, '1M': 30, '1Y': 365 };
    const daysBack = daysMap[range] || 30;

    const startDateCurrent = new Date(now);
    startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);

    // Fechas para el período del año anterior (Exactamente 1 año atrás: 2025)
    const endDateYoY = new Date(now);
    endDateYoY.setFullYear(endDateYoY.getFullYear() - 1);
    
    const startDateYoY = new Date(startDateCurrent);
    startDateYoY.setFullYear(startDateYoY.getFullYear() - 1);

    const fmtISO = (d) => d.toISOString().split('T')[0];

    // 2. Consulta SoQL para Serie Actual (2026)
    const urlCurrent = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde >= '${fmtISO(startDateCurrent)}'&$order=vigenciadesde ASC&$limit=500`;
    
    // 3. Consulta SoQL para Serie YoY (2025)
    const urlYoY = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde >= '${fmtISO(startDateYoY)}' AND vigenciadesde <= '${fmtISO(endDateYoY)}'&$order=vigenciadesde ASC&$limit=500`;

    const [respCurrent, respYoY] = await Promise.all([
      fetch(urlCurrent),
      fetch(urlYoY)
    ]);

    const dataCurrentRaw = await respCurrent.json();
    const dataYoYRaw = await respYoY.json();

    // Mapeo de datos actuales (2026)
    const pointsCurrent = dataCurrentRaw.map((item) => {
      const d = new Date(item.vigenciadesde);
      return {
        t: d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
        v: parseFloat(item.valor)
      };
    });

    // Mapeo de datos año anterior (2025)
    const pointsYoY = dataYoYRaw.map((item) => {
      const d = new Date(item.vigenciadesde);
      return {
        t: d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
        v: parseFloat(item.valor)
      };
    });

    const currentSpot = pointsCurrent.length > 0 ? pointsCurrent[pointsCurrent.length - 1].v : 0;
    const threshold = pointsCurrent.length > 0 ? pointsCurrent[0].v : currentSpot;
    
    // Comparación YoY exacta punto a punto
    const lastYearSpot = pointsYoY.length > 0 ? pointsYoY[pointsYoY.length - 1].v : currentSpot;
    const yoyDiff = currentSpot - lastYearSpot;
    const yoyPct = lastYearSpot ? ((yoyDiff / lastYearSpot) * 100).toFixed(2) : '0.00';

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
    return res.status(500).json({ error: 'Error realizando el QA de datos TRM' });
  }
}
