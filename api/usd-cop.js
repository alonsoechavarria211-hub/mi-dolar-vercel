// api/usd-cop.js
export default async function handler(req, res) {
  try {
    const range = req.query.range || '1M'; // 1D, 1W, 1M, 1Y
    const now = new Date();
    
    let daysBack = 30;
    if (range === '1D') daysBack = 7; // Muestra última semana con detalle diario
    if (range === '1W') daysBack = 14;
    if (range === '1M') daysBack = 30;
    if (range === '1Y') daysBack = 365;

    const startDateCurrent = new Date(now);
    startDateCurrent.setDate(startDateCurrent.getDate() - daysBack);

    const endDateYoY = new Date(now);
    endDateYoY.setFullYear(endDateYoY.getFullYear() - 1);
    endDateYoY.setDate(endDateYoY.getDate() + 5); // Margen para evitar cortes al final

    const startDateYoY = new Date(startDateCurrent);
    startDateYoY.setFullYear(startDateYoY.getFullYear() - 1);

    const fmtISO = (d) => d.toISOString().split('T')[0];

    const urlCurrent = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde >= '${fmtISO(startDateCurrent)}'&$order=vigenciadesde ASC&$limit=1000`;
    const urlYoY = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde >= '${fmtISO(startDateYoY)}' AND vigenciadesde <= '${fmtISO(endDateYoY)}'&$order=vigenciadesde ASC&$limit=1000`;

    const [respCurrent, respYoY] = await Promise.all([
      fetch(urlCurrent),
      fetch(urlYoY)
    ]);

    const dataCurrentRaw = await respCurrent.json();
    const dataYoYRaw = await respYoY.json();

    // Mapear mapas por fecha YYYY-MM-DD
    const mapCurrent = {};
    dataCurrentRaw.forEach(item => {
      const dateStr = item.vigenciadesde.split('T')[0];
      mapCurrent[dateStr] = parseFloat(item.valor);
    });

    const mapYoY = {};
    dataYoYRaw.forEach(item => {
      const dateStr = item.vigenciadesde.split('T')[0];
      mapYoY[dateStr] = parseFloat(item.valor);
    });

    const pointsCurrent = [];
    const pointsYoY = [];

    let lastValCurrent = dataCurrentRaw[0] ? parseFloat(dataCurrentRaw[0].valor) : 3500;
    let lastValYoY = dataYoYRaw[0] ? parseFloat(dataYoYRaw[0].valor) : 3800;

    // Iterar día a día para alineación perfecta y sin vacíos (Forward fill)
    for (let d = new Date(startDateCurrent); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStrCurrent = fmtISO(d);
      
      const dYoY = new Date(d);
      dYoY.setFullYear(dYoY.getFullYear() - 1);
      const dateStrYoY = fmtISO(dYoY);

      if (mapCurrent[dateStrCurrent] !== undefined) lastValCurrent = mapCurrent[dateStrCurrent];
      if (mapYoY[dateStrYoY] !== undefined) lastValYoY = mapYoY[dateStrYoY];

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const labelShort = range === '1Y' 
        ? `${monthNames[d.getMonth()]} ${d.getFullYear()}`
        : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      const labelFull = `${d.getDate()} de ${monthNames[d.getMonth()]} de ${d.getFullYear()}`;

      pointsCurrent.push({ t: labelShort, fullDate: labelFull, v: lastValCurrent });
      pointsYoY.push({ t: labelShort, fullDate: labelFull, v: lastValYoY });
    }

    const currentSpot = pointsCurrent[pointsCurrent.length - 1]?.v || 0;
    const threshold = pointsCurrent[0]?.v || currentSpot;
    const lastYearSpot = pointsYoY[pointsYoY.length - 1]?.v || currentSpot;
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
    return res.status(500).json({ error: 'Error en procesamiento de series' });
  }
}
