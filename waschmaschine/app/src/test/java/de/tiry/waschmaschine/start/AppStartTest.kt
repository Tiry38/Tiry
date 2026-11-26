package de.tiry.waschmaschine.start

import androidx.test.core.app.ActivityScenario
import de.tiry.waschmaschine.App
import de.tiry.waschmaschine.MainActivity
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Startet die ECHTE App (Application + Activity) – muss ohne Absturz hochkommen. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = App::class, qualifiers = "w412dp-h915dp-xxhdpi")
class AppStartTest {
    @Test fun appStartetOhneAbsturz() {
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            s.onActivity { a -> check(!a.isFinishing) { "Activity hat sich beendet" } }
        }
    }
}
