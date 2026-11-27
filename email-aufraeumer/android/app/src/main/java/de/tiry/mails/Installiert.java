package de.tiry.mails;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** Rückmeldung vom Android-Installer beim Selbst-Update: Bestätigungsfenster anzeigen. */
public class Installiert extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        int status = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent bestaetigen = (Intent) i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (bestaetigen != null) c.startActivity(bestaetigen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
    }
}
