import "dotenv/config";
import { releaseExpiredReservations } from "../src/lib/reservations";

releaseExpiredReservations()
  .then((result) => {
    console.log(`Released ${result.released} expired reservation(s).`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
