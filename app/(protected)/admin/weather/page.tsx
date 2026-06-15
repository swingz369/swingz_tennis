import WeatherClient from './weather-client';

export const metadata = {
  title: 'Wetter & Platzsperren — SwingZ',
};

export default function WeatherPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Wetter & Platzsperren</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Wetterüberwachung und Platzsperren für Außenplätze
        </p>
      </div>
      <WeatherClient />
    </div>
  );
}
