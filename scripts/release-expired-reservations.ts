import "dotenv/config";
import { releaseExpiredReservations } from "../src/lib/reservations";
import { RESERVATION_RELEASE_JOB_KEY, runMonitoredJob } from "../src/lib/scheduled-jobs";

runMonitoredJob(RESERVATION_RELEASE_JOB_KEY, () => releaseExpiredReservations())
  .then((result) => {
    console.log(`Released ${result.released} expired reservation(s); scanned ${result.scanned}.`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
