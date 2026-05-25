import { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import { format, parseISO } from "date-fns";

const COLORS = {
  temp: "#e85d26", tempMin: "#378ADD", humid: "#1D9E75",
  rain: "#185FA5", bg: "#0d0d0f", card: "#141418",
  border: "#2a2a30", text: "#f0ede8", muted: "#888780",
};

const CITIES = {
  Bengaluru: { lat: 12.9716, lon: 77.5946, color: "#e85d26" },
  Chennai:   { lat: 13.0827, lon: 80.2707, color: "#1D9E75" },
  Mumbai:    { lat: 19.0760, lon: 72.8777, color: "#378ADD" },
};

const API_BASE    = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";

const weatherLabel = (c) => {
  if (c === 0) return "Clear sky";
  if (c <= 3)  return "Partly cloudy";
  if (c <= 48) return "Foggy";
  if (c <= 67) return "Rainy";
  if (c <= 82) return "Showers";
  if (c <= 99) return "Thunderstorm";
  return "Unknown";
};
const weatherIcon = (c) => {
  if (c === 0) return "☀️";
  if (c <= 3)  return "⛅";
  if (c <= 48) return "🌫️";
  if (c <= 67) return "🌧️";
  if (c <= 82) return "🌦️";
  if (c <= 99) return "⛈️";
  return "🌡️";
};

const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const std = (arr) => { const m = avg(arr); return Math.sqrt(avg(arr.map(x => (x - m) ** 2))); };

export default function App() {
  const [current,     setCurrent]     = useState(null);
  const [forecast,    setForecast]    = useState([]);
  const [hourly,      setHourly]      = useState([]);
  const [historical,  setHistorical]  = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [anomalies,   setAnomalies]   = useState([]);
  const [cityData,    setCityData]    = useState({});
  const [activeCity,  setActiveCity]  = useState("Bengaluru");
  const [loading,     setLoading]     = useState(true);
  const [cityLoading, setCityLoading] = useState(false);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch Bengaluru live + archive on mount ──────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { lat, lon } = CITIES.Bengaluru;

        const [liveRes, archiveRes] = await Promise.all([
          axios.get(API_BASE, {
            params: {
              latitude: lat, longitude: lon,
              current:  "temperature_2m,relative_humidity_2m,apparent_temperature,weathercode,windspeed_10m,precipitation",
              hourly:   "temperature_2m,precipitation_probability,relative_humidity_2m",
              daily:    "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
              timezone: "Asia/Kolkata", forecast_days: 7,
            },
          }),
          axios.get(ARCHIVE_BASE, {
            params: {
              latitude: lat, longitude: lon,
              start_date: "2024-01-01", end_date: "2024-12-31",
              daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean",
              timezone: "Asia/Kolkata",
            },
          }),
        ]);

        // Current
        const c = liveRes.data.current;
        setCurrent({
          temp:      Math.round(c.temperature_2m),
          feelsLike: Math.round(c.apparent_temperature),
          humidity:  c.relative_humidity_2m,
          wind:      Math.round(c.windspeed_10m),
          code:      c.weathercode,
          precip:    c.precipitation,
        });

        // Forecast
        const d = liveRes.data.daily;
        setForecast(d.time.map((t, i) => ({
          day:  format(parseISO(t), "EEE dd"),
          max:  Math.round(d.temperature_2m_max[i]),
          min:  Math.round(d.temperature_2m_min[i]),
          rain: +(d.precipitation_sum[i] || 0).toFixed(1),
          code: d.weathercode[i],
        })));

        // Hourly
        const h = liveRes.data.hourly;
        setHourly(h.time.slice(0, 24).map((t, i) => ({
          hour:      format(parseISO(t), "HH:mm"),
          temp:      Math.round(h.temperature_2m[i]),
          rainChance: h.precipitation_probability[i],
          humidity:  h.relative_humidity_2m[i],
        })));

        // Historical monthly
        const arch = archiveRes.data.daily;
        const monthlyMap = {};
        arch.time.forEach((t, i) => {
          const m = format(parseISO(t), "MMM");
          if (!monthlyMap[m]) monthlyMap[m] = { maxT: [], minT: [], rain: [], humid: [] };
          if (arch.temperature_2m_max[i]       != null) monthlyMap[m].maxT.push(arch.temperature_2m_max[i]);
          if (arch.temperature_2m_min[i]       != null) monthlyMap[m].minT.push(arch.temperature_2m_min[i]);
          if (arch.precipitation_sum[i]        != null) monthlyMap[m].rain.push(arch.precipitation_sum[i]);
          if (arch.relative_humidity_2m_mean[i]!= null) monthlyMap[m].humid.push(arch.relative_humidity_2m_mean[i]);
        });
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const histArr = months.map((m) => {
          const md = monthlyMap[m] || { maxT:[0], minT:[0], rain:[0], humid:[0] };
          const a  = (arr) => Math.round(avg(arr));
          return {
            month: m,
            avgMax:    a(md.maxT),
            avgMin:    a(md.minT),
            totalRain: Math.round(md.rain.reduce((s, v) => s + v, 0)),
            avgHumid:  a(md.humid),
          };
        });
        setHistorical(histArr);

        // Scatter
        setScatterData(
          arch.time.slice(0, 120).map((_, i) => ({
            temp:     Math.round(arch.temperature_2m_max[i]),
            humidity: arch.relative_humidity_2m_mean[i],
          })).filter(x => x.temp && x.humidity)
        );

        // ── ANOMALY DETECTION ─────────────────────────────────────────────
        const allTemps = arch.temperature_2m_max.filter(Boolean);
        const meanT    = avg(allTemps);
        const stdT     = std(allTemps);
        const anomalyList = arch.time.map((t, i) => ({
          date: format(parseISO(t), "dd MMM"),
          temp: Math.round(arch.temperature_2m_max[i]),
          z:    ((arch.temperature_2m_max[i] - meanT) / stdT),
        })).filter(x => Math.abs(x.z) > 2).slice(0, 30);
        setAnomalies(anomalyList);

        setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
        setLoading(false);
      } catch (err) {
        setError("Failed to load weather data. Check your connection.");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Fetch city comparison data ────────────────────────────────────────────
  useEffect(() => {
    const fetchCities = async () => {
      setCityLoading(true);
      try {
        const results = await Promise.all(
          Object.entries(CITIES).map(([name, { lat, lon }]) =>
            axios.get(ARCHIVE_BASE, {
              params: {
                latitude: lat, longitude: lon,
                start_date: "2024-01-01", end_date: "2024-12-31",
                daily: "temperature_2m_max,precipitation_sum",
                timezone: "Asia/Kolkata",
              },
            }).then(res => ({ name, data: res.data.daily }))
          )
        );

        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const cityMonthly = {};
        results.forEach(({ name, data }) => {
          const mm = {};
          data.time.forEach((t, i) => {
            const m = format(parseISO(t), "MMM");
            if (!mm[m]) mm[m] = { temps: [], rain: [] };
            if (data.temperature_2m_max[i] != null) mm[m].temps.push(data.temperature_2m_max[i]);
            if (data.precipitation_sum[i]  != null) mm[m].rain.push(data.precipitation_sum[i]);
          });
          cityMonthly[name] = months.map(m => ({
            month:   m,
            avgTemp: Math.round(avg(mm[m]?.temps || [0])),
            rain:    Math.round((mm[m]?.rain || [0]).reduce((a, b) => a + b, 0)),
          }));
        });
        setCityData(cityMonthly);
      } catch (_) {}
      setCityLoading(false);
    };
    fetchCities();
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    app:     { minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: "4rem" },
    header:  { borderBottom: `1px solid ${COLORS.border}`, padding: "1.5rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.card },
    title:   { fontSize: 20, fontWeight: 600, letterSpacing: "-0.3px", margin: 0 },
    sub:     { fontSize: 13, color: COLORS.muted, marginTop: 2 },
    badge:   { fontSize: 12, color: COLORS.muted, background: "#1e1e24", padding: "4px 12px", borderRadius: 20, border: `1px solid ${COLORS.border}` },
    grid:    { padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem", maxWidth: 1200, margin: "0 auto" },
    kpiRow:  { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 },
    kpiCard: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "1.2rem 1.4rem" },
    kpiLbl:  { fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 },
    kpiVal:  { fontSize: 32, fontWeight: 700, lineHeight: 1 },
    kpiUnit: { fontSize: 14, color: COLORS.muted, marginLeft: 4 },
    kpiSub:  { fontSize: 12, color: COLORS.muted, marginTop: 6 },
    section: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "1.5rem" },
    secTtl:  { fontSize: 14, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 20 },
    twoCol:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    fcRow:   { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 },
    fcCard:  { minWidth: 90, background: "#1a1a20", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", textAlign: "center", flexShrink: 0 },
    loader:  { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", fontSize: 18, color: COLORS.muted },
  };

  if (loading) return <div style={S.loader}>Fetching live Bengaluru weather data...</div>;
  if (error)   return <div style={S.loader}>{error}</div>;

  // ── Derived insight values ────────────────────────────────────────────────
  const hottestM   = historical.reduce((a, b) => a.avgMax    > b.avgMax    ? a : b, historical[0]);
  const wettestM   = historical.reduce((a, b) => a.totalRain > b.totalRain ? a : b, historical[0]);
  const dryestM    = historical.reduce((a, b) => a.totalRain < b.totalRain ? a : b, historical[0]);
  const yearAvgT   = Math.round(avg(historical.map(m => m.avgMax)));
  const totalRain  = historical.reduce((s, m) => s + m.totalRain, 0);
  const monsoonRain= ["Jun","Jul","Aug","Sep"].reduce((s, m) => s + (historical.find(h => h.month === m)?.totalRain || 0), 0);
  const monsoonPct = Math.round((monsoonRain / totalRain) * 100);
  const tempRange  = hottestM.avgMax - historical.reduce((a, b) => a.avgMin < b.avgMin ? a : b, historical[0]).avgMin;
  const hotAnomalies = anomalies.filter(a => a.z > 2).length;
  const coldAnomalies= anomalies.filter(a => a.z < -2).length;

  // ── Comparison chart data (merge months) ─────────────────────────────────
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const compTempData = months.map(m => {
    const row = { month: m };
    Object.keys(CITIES).forEach(city => {
      row[city] = cityData[city]?.find(d => d.month === m)?.avgTemp || null;
    });
    return row;
  });
  const compRainData = months.map(m => {
    const row = { month: m };
    Object.keys(CITIES).forEach(city => {
      row[city] = cityData[city]?.find(d => d.month === m)?.rain || null;
    });
    return row;
  });

  return (
    <div style={S.app}>

      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Bengaluru Weather Analytics</div>
          <div style={S.sub}>Live forecast · 2024 Historical Analysis · Open-Meteo API · 12.97°N, 77.59°E</div>
        </div>
        <div style={S.badge}>Updated {lastUpdated}</div>
      </div>

      <div style={S.grid}>

        {/* ── KPI Cards ── */}
        <div style={S.kpiRow}>
          {[
            { label:"Temperature", val: current.temp,      unit:"°C",   sub:`Feels like ${current.feelsLike}°C`,                                             color: COLORS.temp  },
            { label:"Humidity",    val: current.humidity,  unit:"%",    sub: current.humidity>70?"High moisture":current.humidity>50?"Moderate":"Comfortable", color: COLORS.humid },
            { label:"Wind Speed",  val: current.wind,      unit:"km/h", sub: current.wind<20?"Calm breeze":current.wind<40?"Moderate wind":"Strong wind",      color: "#FAC775"    },
            { label:"Precipitation",val:current.precip.toFixed(1),unit:"mm",sub:"Current hour",                                                               color: COLORS.rain  },
          ].map(k => (
            <div key={k.label} style={S.kpiCard}>
              <div style={S.kpiLbl}>{k.label}</div>
              <div style={S.kpiVal}><span style={{color:k.color}}>{k.val}</span><span style={S.kpiUnit}>{k.unit}</span></div>
              <div style={S.kpiSub}>{k.sub}</div>
            </div>
          ))}
          <div style={S.kpiCard}>
            <div style={S.kpiLbl}>Condition</div>
            <div style={{fontSize:28,marginBottom:6}}>{weatherIcon(current.code)}</div>
            <div style={{fontSize:13,color:COLORS.muted}}>{weatherLabel(current.code)}</div>
          </div>
        </div>

        {/* ── PHASE 5: 4 Analyst Insight Cards ── */}
        {/* Section header */}
        <div style={{fontSize:13,color:COLORS.muted,borderLeft:`3px solid #e85d26`,paddingLeft:12}}>
          <strong style={{color:COLORS.text}}>2024 Historical Analysis</strong> — patterns derived from 365 days of Bengaluru weather data
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12}}>
          {[
            {
              icon:"🌡️", color:"#e85d26",
              title:"Temperature Stability",
              text:`Annual temp range is only ${tempRange}°C — Bengaluru is one of India's most stable climates year-round. Hottest month: ${hottestM.month} at avg ${hottestM.avgMax}°C.`,
            },
            {
              icon:"🌧️", color:"#185FA5",
              title:"Monsoon Dominance",
              text:`${monsoonPct}% of annual rainfall (${monsoonRain}mm of ${totalRain}mm) falls in just Jun–Sep. ${dryestM.month} gets just ${dryestM.totalRain}mm — a ${Math.round(wettestM.totalRain/Math.max(dryestM.totalRain,1))}x contrast.`,
            },
            {
              icon:"⚠️", color:"#FAC775",
              title:"Anomaly Detection (2024)",
              text:`${hotAnomalies} unusually hot days and ${coldAnomalies} unusually cold days detected in 2024 — days that deviated more than 2 standard deviations from the annual mean.`,
            },
            {
              icon:"📈", color:"#1D9E75",
              title:"Annual Average",
              text:`2024 annual average high was ${yearAvgT}°C. Peak monsoon month: ${wettestM.month} with ${wettestM.totalRain}mm. Bengaluru's elevation (920m) keeps it cooler than coastal cities.`,
            },
          ].map(card => (
            <div key={card.title} style={{...S.kpiCard, borderLeft:`3px solid ${card.color}`}}>
              <div style={{fontSize:20,marginBottom:8}}>{card.icon}</div>
              <div style={{fontSize:13,fontWeight:600,color:card.color,marginBottom:6}}>{card.title}</div>
              <div style={{fontSize:12,color:COLORS.muted,lineHeight:1.7}}>{card.text}</div>
            </div>
          ))}
        </div>

        {/* ── 7-Day Forecast ── */}
        <div style={S.section}>
          <div style={S.secTtl}>7-Day Forecast</div>
          <div style={S.fcRow}>
            {forecast.map((f,i) => (
              <div key={i} style={S.fcCard}>
                <div style={{fontSize:11,color:COLORS.muted,marginBottom:6}}>{f.day}</div>
                <div style={{fontSize:20,marginBottom:6}}>{weatherIcon(f.code)}</div>
                <div style={{fontSize:15,fontWeight:600,color:COLORS.temp}}>{f.max}°</div>
                <div style={{fontSize:12,color:COLORS.tempMin}}>{f.min}°</div>
                <div style={{fontSize:11,color:COLORS.muted,marginTop:4}}>{f.rain}mm</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Temp trend + Rain ── */}
        <div style={S.twoCol}>
          <div style={S.section}>
            <div style={S.secTtl}>7-Day Temperature Range (°C)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
                <XAxis dataKey="day" tick={{fill:COLORS.muted,fontSize:11}}/>
                <YAxis tick={{fill:COLORS.muted,fontSize:11}} domain={["auto","auto"]}/>
                <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
                <Legend wrapperStyle={{fontSize:12}}/>
                <Line type="monotone" dataKey="max" stroke={COLORS.temp}    strokeWidth={2} dot={{r:3}} name="Max °C"/>
                <Line type="monotone" dataKey="min" stroke={COLORS.tempMin} strokeWidth={2} dot={{r:3}} name="Min °C"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={S.section}>
            <div style={S.secTtl}>7-Day Rainfall (mm)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
                <XAxis dataKey="day" tick={{fill:COLORS.muted,fontSize:11}}/>
                <YAxis tick={{fill:COLORS.muted,fontSize:11}}/>
                <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
                <Bar dataKey="rain" fill={COLORS.rain} radius={[4,4,0,0]} name="Rain mm"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Hourly ── */}
        <div style={S.section}>
          <div style={S.secTtl}>Hourly Forecast — Next 24 Hours</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
              <XAxis dataKey="hour" tick={{fill:COLORS.muted,fontSize:10}} interval={2}/>
              <YAxis yAxisId="temp" tick={{fill:COLORS.muted,fontSize:11}} domain={["auto","auto"]}/>
              <YAxis yAxisId="rain" orientation="right" tick={{fill:COLORS.muted,fontSize:11}} domain={[0,100]}/>
              <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Line yAxisId="temp" type="monotone" dataKey="temp"       stroke={COLORS.temp} strokeWidth={2} dot={false} name="Temp °C"/>
              <Line yAxisId="rain" type="monotone" dataKey="rainChance" stroke={COLORS.rain} strokeWidth={2} dot={false} strokeDasharray="4 2" name="Rain chance %"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── PHASE 5: Anomaly Detection Chart ── */}
        <div style={S.section}>
          <div style={S.secTtl}>⚠️ 2024 Historical Analysis — Temperature Anomalies (days &gt; 2σ from mean)</div>
          <div style={{fontSize:12,color:COLORS.muted,marginBottom:16}}>
            Each bar is a day with unusually high or low temperature. Red = hotter than normal. Blue = colder than normal. This is statistical outlier detection.
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={anomalies}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
              <XAxis dataKey="date" tick={{fill:COLORS.muted,fontSize:10}} interval={2}/>
              <YAxis tick={{fill:COLORS.muted,fontSize:11}} label={{value:"Temp °C",angle:-90,position:"insideLeft",fill:COLORS.muted,fontSize:11}}/>
              <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}} formatter={(v,n,p) => [`${v}°C (z=${p.payload.z?.toFixed(1)})`, "Temp"]}/>
              <ReferenceLine y={yearAvgT} stroke="#FAC775" strokeDasharray="4 2" label={{value:`Mean ${yearAvgT}°C`,fill:"#FAC775",fontSize:11}}/>
              <Bar dataKey="temp" radius={[4,4,0,0]} name="Temp °C"
                fill={COLORS.temp}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Historical monthly ── */}
        <div style={S.twoCol}>
          <div style={S.section}>
            <div style={S.secTtl}>2024 Historical Analysis — Monthly Rainfall (mm)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={historical}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
                <XAxis dataKey="month" tick={{fill:COLORS.muted,fontSize:11}}/>
                <YAxis tick={{fill:COLORS.muted,fontSize:11}}/>
                <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
                <Bar dataKey="totalRain" fill={COLORS.rain} radius={[4,4,0,0]} name="Rainfall mm"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={S.section}>
            <div style={S.secTtl}>2024 Historical Analysis — Temp vs Humidity Correlation</div>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
                <XAxis dataKey="temp"     name="Temp °C"    tick={{fill:COLORS.muted,fontSize:11}}/>
                <YAxis dataKey="humidity" name="Humidity %" tick={{fill:COLORS.muted,fontSize:11}}/>
                <Tooltip cursor={{strokeDasharray:"3 3"}} contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
                <Scatter data={scatterData} fill={COLORS.humid} opacity={0.6} name="Daily reading"/>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 2024 annual temp ── */}
        <div style={S.section}>
          <div style={S.secTtl}>2024 Historical Analysis — Monthly Average Temperature (°C)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historical}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
              <XAxis dataKey="month" tick={{fill:COLORS.muted,fontSize:11}}/>
              <YAxis tick={{fill:COLORS.muted,fontSize:11}} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Line type="monotone" dataKey="avgMax" stroke={COLORS.temp}    strokeWidth={2} dot={{r:3}} name="Avg Max °C"/>
              <Line type="monotone" dataKey="avgMin" stroke={COLORS.tempMin} strokeWidth={2} dot={{r:3}} name="Avg Min °C"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── PHASE 5: City Comparison ── */}
        <div style={S.section}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={S.secTtl} className="no-mb">🏙️ 2024 Historical Analysis — Bengaluru vs Chennai vs Mumbai</div>
            <div style={{display:"flex",gap:8}}>
              {["Temperature","Rainfall"].map(tab => (
                <button key={tab}
                  onClick={() => setActiveCity(tab)}
                  style={{
                    padding:"5px 14px", borderRadius:20, fontSize:12, cursor:"pointer",
                    border:`1px solid ${activeCity===tab?"#e85d26":COLORS.border}`,
                    background: activeCity===tab?"#e85d2620":"transparent",
                    color: activeCity===tab?"#e85d26":COLORS.muted,
                  }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
          {cityLoading ? (
            <div style={{textAlign:"center",color:COLORS.muted,padding:"2rem"}}>Loading city data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              {activeCity === "Temperature" ? (
                <LineChart data={compTempData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
                  <XAxis dataKey="month" tick={{fill:COLORS.muted,fontSize:11}}/>
                  <YAxis tick={{fill:COLORS.muted,fontSize:11}} domain={["auto","auto"]} label={{value:"Avg Max °C",angle:-90,position:"insideLeft",fill:COLORS.muted,fontSize:11}}/>
                  <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
                  <Legend wrapperStyle={{fontSize:12}}/>
                  {Object.entries(CITIES).map(([city,{color}]) => (
                    <Line key={city} type="monotone" dataKey={city} stroke={color} strokeWidth={2} dot={{r:3}} connectNulls/>
                  ))}
                </LineChart>
              ) : (
                <BarChart data={compRainData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a30"/>
                  <XAxis dataKey="month" tick={{fill:COLORS.muted,fontSize:11}}/>
                  <YAxis tick={{fill:COLORS.muted,fontSize:11}} label={{value:"Rainfall mm",angle:-90,position:"insideLeft",fill:COLORS.muted,fontSize:11}}/>
                  <Tooltip contentStyle={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:8}}/>
                  <Legend wrapperStyle={{fontSize:12}}/>
                  {Object.entries(CITIES).map(([city,{color}]) => (
                    <Bar key={city} dataKey={city} fill={color} radius={[3,3,0,0]}/>
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
          <div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {Object.entries(CITIES).map(([city,{color}]) => {
              const cd = cityData[city];
              if (!cd) return null;
              const cityAvgTemp = Math.round(avg(cd.map(m => m.avgTemp)));
              const cityTotalRain = cd.reduce((s,m) => s+m.rain, 0);
              return (
                <div key={city} style={{background:"#1a1a20",borderRadius:8,padding:"10px 14px",borderLeft:`3px solid ${color}`}}>
                  <div style={{fontSize:13,fontWeight:600,color,marginBottom:4}}>{city}</div>
                  <div style={{fontSize:12,color:COLORS.muted}}>Avg temp: <strong style={{color:COLORS.text}}>{cityAvgTemp}°C</strong></div>
                  <div style={{fontSize:12,color:COLORS.muted}}>Annual rain: <strong style={{color:COLORS.text}}>{cityTotalRain}mm</strong></div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}