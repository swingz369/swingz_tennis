import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const holidays = [
  // Bayern 2026
  {
    bundesland: 'Bayern',
    name: 'Winterferien',
    start_date: '2026-02-23',
    end_date: '2026-02-27',
    year: 2026,
  },
  {
    bundesland: 'Bayern',
    name: 'Osterferien',
    start_date: '2026-04-06',
    end_date: '2026-04-18',
    year: 2026,
  },
  {
    bundesland: 'Bayern',
    name: 'Pfingstferien',
    start_date: '2026-05-26',
    end_date: '2026-06-06',
    year: 2026,
  },
  {
    bundesland: 'Bayern',
    name: 'Sommerferien',
    start_date: '2026-07-27',
    end_date: '2026-09-07',
    year: 2026,
  },
  {
    bundesland: 'Bayern',
    name: 'Herbstferien',
    start_date: '2026-10-31',
    end_date: '2026-11-06',
    year: 2026,
  },
  {
    bundesland: 'Bayern',
    name: 'Weihnachtsferien',
    start_date: '2026-12-23',
    end_date: '2027-01-05',
    year: 2026,
  },
  // Bayern 2027
  {
    bundesland: 'Bayern',
    name: 'Winterferien',
    start_date: '2027-02-22',
    end_date: '2027-02-26',
    year: 2027,
  },
  {
    bundesland: 'Bayern',
    name: 'Sommerferien',
    start_date: '2027-07-26',
    end_date: '2027-09-06',
    year: 2027,
  },
  // NRW 2026
  {
    bundesland: 'Nordrhein-Westfalen',
    name: 'Osterferien',
    start_date: '2026-03-30',
    end_date: '2026-04-11',
    year: 2026,
  },
  {
    bundesland: 'Nordrhein-Westfalen',
    name: 'Pfingstferien',
    start_date: '2026-05-26',
    end_date: '2026-06-06',
    year: 2026,
  },
  {
    bundesland: 'Nordrhein-Westfalen',
    name: 'Sommerferien',
    start_date: '2026-06-29',
    end_date: '2026-08-11',
    year: 2026,
  },
  {
    bundesland: 'Nordrhein-Westfalen',
    name: 'Herbstferien',
    start_date: '2026-10-12',
    end_date: '2026-10-23',
    year: 2026,
  },
  {
    bundesland: 'Nordrhein-Westfalen',
    name: 'Weihnachtsferien',
    start_date: '2026-12-23',
    end_date: '2027-01-06',
    year: 2026,
  },
  // Baden-Württemberg 2026
  {
    bundesland: 'Baden-Württemberg',
    name: 'Osterferien',
    start_date: '2026-04-01',
    end_date: '2026-04-17',
    year: 2026,
  },
  {
    bundesland: 'Baden-Württemberg',
    name: 'Pfingstferien',
    start_date: '2026-06-02',
    end_date: '2026-06-13',
    year: 2026,
  },
  {
    bundesland: 'Baden-Württemberg',
    name: 'Sommerferien',
    start_date: '2026-07-30',
    end_date: '2026-09-12',
    year: 2026,
  },
  {
    bundesland: 'Baden-Württemberg',
    name: 'Herbstferien',
    start_date: '2026-10-26',
    end_date: '2026-10-30',
    year: 2026,
  },
  {
    bundesland: 'Baden-Württemberg',
    name: 'Weihnachtsferien',
    start_date: '2026-12-23',
    end_date: '2027-01-09',
    year: 2026,
  },
  // Berlin 2026
  {
    bundesland: 'Berlin',
    name: 'Winterferien',
    start_date: '2026-02-02',
    end_date: '2026-02-07',
    year: 2026,
  },
  {
    bundesland: 'Berlin',
    name: 'Osterferien',
    start_date: '2026-04-02',
    end_date: '2026-04-11',
    year: 2026,
  },
  {
    bundesland: 'Berlin',
    name: 'Sommerferien',
    start_date: '2026-06-18',
    end_date: '2026-08-01',
    year: 2026,
  },
  {
    bundesland: 'Berlin',
    name: 'Herbstferien',
    start_date: '2026-10-19',
    end_date: '2026-10-30',
    year: 2026,
  },
  {
    bundesland: 'Berlin',
    name: 'Weihnachtsferien',
    start_date: '2026-12-21',
    end_date: '2027-01-02',
    year: 2026,
  },
  // Hamburg 2026
  {
    bundesland: 'Hamburg',
    name: 'Winterferien',
    start_date: '2026-01-30',
    end_date: '2026-01-30',
    year: 2026,
  },
  {
    bundesland: 'Hamburg',
    name: 'Osterferien',
    start_date: '2026-03-16',
    end_date: '2026-03-27',
    year: 2026,
  },
  {
    bundesland: 'Hamburg',
    name: 'Sommerferien',
    start_date: '2026-06-18',
    end_date: '2026-07-29',
    year: 2026,
  },
  {
    bundesland: 'Hamburg',
    name: 'Herbstferien',
    start_date: '2026-10-01',
    end_date: '2026-10-16',
    year: 2026,
  },
  {
    bundesland: 'Hamburg',
    name: 'Weihnachtsferien',
    start_date: '2026-12-18',
    end_date: '2027-01-01',
    year: 2026,
  },
  // Hessen 2026
  {
    bundesland: 'Hessen',
    name: 'Osterferien',
    start_date: '2026-04-01',
    end_date: '2026-04-11',
    year: 2026,
  },
  {
    bundesland: 'Hessen',
    name: 'Sommerferien',
    start_date: '2026-07-06',
    end_date: '2026-08-14',
    year: 2026,
  },
  {
    bundesland: 'Hessen',
    name: 'Herbstferien',
    start_date: '2026-10-05',
    end_date: '2026-10-17',
    year: 2026,
  },
  {
    bundesland: 'Hessen',
    name: 'Weihnachtsferien',
    start_date: '2026-12-23',
    end_date: '2027-01-09',
    year: 2026,
  },
];

async function seed() {
  const { error } = await supabase
    .from('school_holidays')
    .upsert(holidays, { onConflict: 'bundesland,name,year' });
  if (error) throw error;
  console.log(`✅ Seeded ${holidays.length} school holiday records`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
