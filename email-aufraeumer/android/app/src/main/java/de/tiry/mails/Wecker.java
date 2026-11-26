package de.tiry.mails;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Weckt den Wächter auch im Tiefschlaf des Handys (Wecker aus Waechter.weckerStellen). */
public class Wecker extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (!Waechter.an(c) || !Anmeldung.von(c).angemeldet()) return;
        try { c.startForegroundService(new Intent(c, Waechter.class).setAction(Waechter.AKTION_TICK)); } catch (Exception ignored) { }
    }
}
