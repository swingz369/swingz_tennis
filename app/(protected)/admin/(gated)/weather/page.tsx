import WeatherClient from './weather-client';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = {
  title: 'Wetter & Platzsperren — SwingZ',
};

export default function WeatherPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Wetter & Platzsperren"
        description="Wetterüberwachung und Platzsperren für Außenplätze"
        breadcrumbs={[{ label: 'Platzsperren & Wetter' }]}
      />
      <WeatherClient />
    </div>
  );
}
