plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Signatur: Für dauerhafte Updates gleiche Signatur. Eigener Key über Umgebungsvariablen (GitHub-Secrets),
// sonst der mitgelieferte Debug-Schlüssel (nur für private Installation gedacht).
val ksFile = System.getenv("LUNA_KEYSTORE_FILE")?.let { file(it) } ?: rootProject.file("signing/luna-debug.jks")
val ksPass = System.getenv("LUNA_KEYSTORE_PASSWORD") ?: "android"
val ksAlias = System.getenv("LUNA_KEY_ALIAS") ?: "luna"
val ksKeyPass = System.getenv("LUNA_KEY_PASSWORD") ?: ksPass

android {
    namespace = "de.tiry.luna"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.tiry.luna"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("LUNA_VERSION_CODE") ?: "1").toInt()
        versionName = "1.0." + (System.getenv("LUNA_VERSION_CODE") ?: "0")
        // Nur echte Handy-Prozessoren (spart ~20 MB)
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    signingConfigs {
        create("luna") {
            storeFile = ksFile
            storePassword = ksPass
            keyAlias = ksAlias
            keyPassword = ksKeyPass
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("luna")
        }
        debug {
            signingConfig = signingConfigs.getByName("luna")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures { buildConfig = true }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/DEPENDENCIES", "META-INF/LICENSE*", "META-INF/NOTICE*",
                "META-INF/*.kotlin_module", "META-INF/versions/**", "META-INF/INDEX.LIST",
            )
        }
    }

    testOptions { unitTests.isReturnDefaultValues = true; unitTests.isIncludeAndroidResources = true }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.anthropic:anthropic-java:3.12.0")
    implementation("com.alphacephei:vosk-android:0.3.75@aar")
    implementation("net.java.dev.jna:jna:5.18.1@aar")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.robolectric:robolectric:4.14.1")
}
