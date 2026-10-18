"""Container entry point for the persistent AGB raster worker."""

import logging
import signal
from threading import Event

from app.services.agb_worker.raster_analysis_worker import (
    initialize_earth_engine_high_volume,
    run_worker,
)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    stop_event = Event()
    signal.signal(signal.SIGINT, lambda _signum, _frame: stop_event.set())
    signal.signal(signal.SIGTERM, lambda _signum, _frame: stop_event.set())
    while not stop_event.is_set():
        try:
            initialize_earth_engine_high_volume()
            break
        except Exception as e:
            logging.error("Failed to initialize Earth Engine: %s. Retrying in 15 seconds...", e)
            stop_event.wait(15)

    if not stop_event.is_set():
        run_worker(stop_event=stop_event)


if __name__ == "__main__":
    main()