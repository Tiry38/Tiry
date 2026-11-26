package de.tiry.mails;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Nach dem Einschalten des Handys oder nach einem Update: Wächter wieder starten. */
public class Neustart extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { Waechter.starten(c); }
}
