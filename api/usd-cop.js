export default async function handler(req, res) {
  try {
    const url = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=30&$order=vigenciadesde%20DESC';
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    const ordenados = datos.reverse();

    const points = ordenados.map((fila) => {
      const fecha = new Date(fila.vigenciadesde);
      const etiqueta = fecha.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit'
      });
      return {
        t: etiqueta,
        v: parseFloat(fila.valor)
      };
    });

    const threshold = points.length > 0 ? points[0].v : 3620.00;
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');
    return res.status(200).json({ threshold, points });
  } catch (error) {
    return res.status(200).json({
      threshold: 3620.00,
      points: [
        { t: '08:00', v: 3649.50 },
        { t: '09:00', v: 3661.00 },
        { t: '10:00', v: 3689.20 },
        { t: '11:00', v: 3624.10 },
        { t: '12:00', v: 3611.80 },
        { t: '13:00', v: 3582.40 },
        { t: '14:00', v: 3553.90 }
      ]
    });
  }
}