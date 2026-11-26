package de.tiry.waschmaschine.kern

import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.takeWhile
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit

/**
 * Hintergrund-Prüfung. Sparsam: alle 15 min kurz nachsehen. Läuft ein Waschgang, wird daraus ein
 * Vordergrunddienst, der die Verbindung bis zum Ende hält – nur dann, nie sonst.
 */
class Pruefer(ctx: Context, p: WorkerParameters) : CoroutineWorker(ctx, p) {
    override suspend fun doWork(): Result {
        val z = Zentrale.von(applicationContext)
        if (z.ablage.profil == null) return Result.success()
        val wer = "hintergrund-" + id
        z.start(wer)
        try {
            val erster = z.warteAufZustand(90_000) ?: return Result.success()
            if (!erster.laeuftGerade) return Result.success()
            val vorne = runCatching { setForeground(info(z)) }.isSuccess
            if (!vorne) return Result.success() // Endprüfung ist bereits geplant
            // Begleiten bis der Waschgang vorbei ist (inkl. kurzer Abrisse, die die Zentrale selbst repariert)
            combine(z.zustand, z.weg) { a, b -> a to b }
                .takeWhile { (zu, _) -> zu == null || zu.laeuftGerade }
                .collect { runCatching { setForeground(info(z)) } }
            withTimeoutOrNull(5_000) { z.zustand.first { it != null } }
            return Result.success()
        } finally {
            z.stop(wer)
        }
    }

    private fun info(z: Zentrale): ForegroundInfo {
        val n = z.melder.laufend(z.zustand.value, z.weg.value.weg.wort)
        return if (Build.VERSION.SDK_INT >= 29) ForegroundInfo(Melder.LAUF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        else ForegroundInfo(Melder.LAUF_ID, n)
    }
}

object Planer {
    fun regelmaessig(ctx: Context) = WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
        "pruefen-regelmaessig", ExistingPeriodicWorkPolicy.KEEP,
        PeriodicWorkRequestBuilder<Pruefer>(15, TimeUnit.MINUTES).build(),
    )

    /** Gezielte Prüfung zum erwarteten Ende bzw. 30 min nach Fertig. */
    fun plane(ctx: Context, zeitMs: Long?) {
        val wm = WorkManager.getInstance(ctx)
        if (zeitMs == null) { wm.cancelUniqueWork("pruefen-gezielt"); return }
        val verz = (zeitMs - System.currentTimeMillis()).coerceAtLeast(0)
        wm.enqueueUniqueWork("pruefen-gezielt", ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<Pruefer>().setInitialDelay(verz, TimeUnit.MILLISECONDS).build())
    }

    /** Waschgang läuft: Hintergrund-Begleiter starten (falls noch keiner läuft). */
    fun begleite(ctx: Context) = WorkManager.getInstance(ctx).enqueueUniqueWork(
        "begleiten", ExistingWorkPolicy.KEEP, OneTimeWorkRequestBuilder<Pruefer>().build(),
    )
}
