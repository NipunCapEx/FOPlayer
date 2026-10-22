package com.nipun.finance.fno

import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayInputStream
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.nipun.finance.fno/auth_diagnostics"
        ).setMethodCallHandler { call, result ->
            if (call.method != "signingInfo") {
                result.notImplemented()
            } else {
                try {
                    val certificates = signingCertificates().map { signature ->
                        CertificateFactory.getInstance("X.509")
                            .generateCertificate(
                                ByteArrayInputStream(signature.toByteArray())
                            ) as X509Certificate
                    }
                    val sha1 = certificates.map { fingerprint(it, "SHA-1") }
                    val sha256 = certificates.map { fingerprint(it, "SHA-256") }
                    val resourceId = resources.getIdentifier(
                        "default_web_client_id", "string", packageName
                    )
                    val webClientId = if (resourceId == 0) "" else getString(resourceId)
                    val diagnostic = mapOf(
                        "packageName" to packageName,
                        "signerSha1" to sha1.joinToString(","),
                        "signerSha256" to sha256.joinToString(","),
                        "webClientId" to webClientId
                    )
                    Log.i(
                        "FOPLAYER_AUTH_DIAGNOSTICS",
                        diagnostic.entries.joinToString(" ") { "${it.key}=${it.value}" }
                    )
                    result.success(diagnostic)
                } catch (error: Exception) {
                    Log.e("FOPLAYER_AUTH_DIAGNOSTICS", "Could not read signing identity", error)
                    result.error("SIGNING_DIAGNOSTICS_FAILED", error.message, null)
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun signingCertificates(): List<android.content.pm.Signature> {
        val info: PackageInfo = if (Build.VERSION.SDK_INT >= 33) {
            packageManager.getPackageInfo(
                packageName,
                PackageManager.PackageInfoFlags.of(
                    PackageManager.GET_SIGNING_CERTIFICATES.toLong()
                )
            )
        } else if (Build.VERSION.SDK_INT >= 28) {
            packageManager.getPackageInfo(
                packageName, PackageManager.GET_SIGNING_CERTIFICATES
            )
        } else {
            packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
        }
        val signatures = if (Build.VERSION.SDK_INT >= 28) {
            info.signingInfo?.apkContentsSigners
        } else {
            info.signatures
        }
        return signatures?.toList()
            ?: throw IllegalStateException("No app signing certificate was found")
    }

    private fun fingerprint(certificate: X509Certificate, algorithm: String): String =
        MessageDigest.getInstance(algorithm).digest(certificate.encoded)
            .joinToString(":") { byte -> "%02X".format(byte.toInt() and 0xff) }
}
