# Automatic Cutter Text Outlines

Editable Design Studio text remains editable in saved projects and version history. When an operator exports cut-path SVG, HPGL/PLT or DXF, the browser renders each visible text layer with its selected font and weight, traces the rendered letters into closed contours and adds those contours to the cutter output.

The downloaded cutter file contains paths only and does not depend on the cutter computer having the same font installed. The generated text paths are checked against the production sheet before download or direct serial sending.

If the selected font is unavailable in the current browser, the browser fallback is outlined and the operator receives a warning. Raster pictures, externally linked artwork and unsupported embedded SVG elements continue to fail closed because they cannot be converted safely without a deliberate tracing workflow.
