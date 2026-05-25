🌦️ Bengaluru Weather Analytics Dashboard
A real-time weather analytics dashboard for Bengaluru, India — built to demonstrate data analyst skills including live API integration, historical trend analysis, statistical anomaly detection, and multi-city comparison.
🔗 Live Demo: bengaluru-weather.vercel.app

📊 What This Project Does
This is not just a weather app — it's a data analytics project that tells the story of Bengaluru's climate through data.
Live Data (Real-Time)

Current temperature, humidity, wind speed, and conditions
7-day forecast with daily max/min and rainfall
Hourly temperature and rain probability for next 24 hours

2024 Historical Analysis (365 days of data)

Monthly rainfall pattern — identifying monsoon dominance
Monthly average temperature trend across the full year
Temperature vs humidity correlation (scatter plot)
Statistical anomaly detection — flags days more than 2 standard deviations from the annual mean

Analyst Insights (Auto-Generated)
The dashboard automatically computes and displays findings such as:

What % of annual rainfall falls in the monsoon months (Jun–Sep)
How many unusually hot/cold days occurred in 2024
Bengaluru's temperature stability compared to coastal cities
Peak monsoon month and driest month contrast ratio

City Comparison
Side-by-side comparison of Bengaluru, Chennai, and Mumbai across:

Monthly average temperature (line chart)
Monthly rainfall (bar chart)


🛠️ Tech Stack
TechnologyPurposeReact.jsFrontend frameworkRechartsData visualizations (line, bar, scatter charts)AxiosAPI callsdate-fnsDate formattingOpen-Meteo APILive forecast + historical weather data (free, no API key)VercelDeployment and hosting

📡 Data Source
Open-Meteo — a free, open-source weather API with no API key required.
Two endpoints used:

api.open-meteo.com/v1/forecast — live current conditions and 7-day forecast
archive-api.open-meteo.com/v1/archive — historical daily data (2024 full year)

Location: Bengaluru, Karnataka — Latitude 12.97°N, Longitude 77.59°E

🔍 Key Analytical Findings (2024)

52% of annual rainfall falls in just 4 monsoon months (Jun–Sep)
25 anomalous hot days detected in 2024 using 2σ statistical threshold
Annual temperature range is only ~20°C — unusually stable for an Indian city
October was the peak rainfall month with 240mm total
April was the hottest month with an average max of 37°C


🚀 Run Locally
bash# Clone the repository
git clone https://github.com/Svardhan1/bengaluru-weather.git

# Navigate into the project
cd bengaluru-weather

# Install dependencies
npm install

# Start the development server
npm start
Open http://localhost:3000 in your browser.

📁 Project Structure
src/
└── App.js          # Main dashboard — all components, API calls, and analytics logic

💡 Skills Demonstrated

API Integration — fetching and handling real-time + historical data
Data Wrangling — transforming raw daily data into monthly aggregates
Statistical Analysis — mean, standard deviation, anomaly detection (z-score method)
Data Visualization — 8 chart types across multiple dimensions
Storytelling with Data — auto-generated insights from computed metrics
Deployment — CI/CD pipeline via GitHub + Vercel


👤 Author
Vardhan S

Data source: Open-Meteo | Built with React + Recharts | Deployed on Vercel
