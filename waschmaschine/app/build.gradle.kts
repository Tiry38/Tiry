plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("io.github.takahirom.roborazzi")
}

val buildNr = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "de.tiry.waschmaschine"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.tiry.waschmaschine"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNr
        versionName = "1.0.$buildNr"
    }

    signingConfigs {
        create("release") {
            // Eigener, fester Signaturschlüssel aus GitHub-Secret (falls gesetzt),
            // sonst der feste App-Testschlüssel im Repo (nur Signatur, keine Geräte-/VPN-Schlüssel).
            val ks = System.getenv("WM_KEYSTORE_FILE")
            if (ks != null && file(ks).exists()) {
                storeFile = file(ks)
                storePassword = System.getenv("WM_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("WM_KEY_ALIAS")
                keyPassword = System.getenv("WM_KEY_PASSWORD")
            } else {
                storeFile = file("signatur/app-test.keystore")
                storePassword = "waschmaschine"
                keyAlias = "waschmaschine"
                keyPassword = "waschmaschine"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.all {
            it.systemProperty("robolectric.pixelCopyRenderMode", "hardware")
            System.getenv("ROBOLECTRIC_REPO")?.let { url -> it.systemProperty("robolectric.dependency.repo.url", url) }
        }
    }
    packaging {
        resources.excludes += setOf("META-INF/versions/9/OSGI-INF/MANIFEST.MF", "META-INF/DEPENDENCIES", "META-INF/LICENSE*", "META-INF/NOTICE*")
        jniLibs.useLegacyPackaging = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")

    implementation(platform("androidx.compose:compose-bom:2025.04.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")

    // Lokales Geräteprotokoll: TLS-PSK (ECDHE-PSK-CHACHA20-POLY1305)
    implementation("org.bouncycastle:bctls-jdk18on:1.80")
    implementation("org.bouncycastle:bcprov-jdk18on:1.80")
    // Unterwegs: WireGuard direkt in der App (VpnService)
    implementation("com.wireguard.android:tunnel:1.0.20250531")
    // QR-Code der FRITZ!Box scannen (ohne Google-Dienste)
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.1")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:1.43.0")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.43.0")
    testImplementation("androidx.test:core:1.6.1")
}
