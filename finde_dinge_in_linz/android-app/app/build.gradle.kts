plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "at.findedingeinlinz.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "at.findedingeinlinz.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    sourceSets["main"].assets.srcDirs("../../")
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
