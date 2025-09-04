# Add project specific ProGuard rules here.
# You can find common ProGuard rules at:
# https://www.guardsquare.com/en/products/proguard/manual/examples
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**

-keep class okio.** { *; }
-dontwarn okio.**

# For BouncyCastle, used by OkHttp for TLS
-dontwarn org.bouncycastle.**

# For Conscrypt, used by OkHttp for TLS
-dontwarn org.conscrypt.**

# For OpenJSSE, used by OkHttp for TLS
-dontwarn org.openjsse.**
