package de.tiry.waschmaschine.netz

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.common.InputImage

/** QR-Code der FRITZ!Box lesen – live mit der Kamera oder aus einem Screenshot/Foto. */
object QrLeser {
    /** Google-Kamera-Scanner (liest dichte Codes auch vom Monitor). fehler(null) = abgebrochen. */
    fun scanne(ctx: Context, ok: (String) -> Unit, fehler: (Exception?) -> Unit) {
        val opt = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build()
        GmsBarcodeScanning.getClient(ctx, opt).startScan()
            .addOnSuccessListener { b -> b.rawValue?.let(ok) ?: fehler(IllegalStateException("Leerer Code")) }
            .addOnCanceledListener { fehler(null) }
            .addOnFailureListener { fehler(it) }
    }

    /** QR aus einem Bild (Screenshot oder Foto) – läuft komplett auf dem Handy. */
    fun ausBild(ctx: Context, bild: Uri, ok: (String) -> Unit, fehler: (Exception) -> Unit) {
        val leser = BarcodeScanning.getClient(BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build())
        val img = try { InputImage.fromFilePath(ctx, bild) } catch (e: Exception) { fehler(e); return }
        leser.process(img)
            .addOnSuccessListener { l -> l.firstNotNullOfOrNull { it.rawValue }?.let(ok) ?: fehler(IllegalStateException("Kein QR-Code im Bild gefunden. Bitte den Code größer/schärfer aufnehmen.")) }
            .addOnFailureListener(fehler)
    }
}
