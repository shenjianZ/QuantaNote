package com.quantanote.desktop

import android.os.Bundle
import android.system.Os
import androidx.activity.enableEdgeToEdge
import java.io.File

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    getExternalFilesDir(null)?.let { externalFilesDir ->
      Os.setenv("QUANTANOTE_DATA_DIR", File(externalFilesDir, "quantanote").absolutePath, true)
    }
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
