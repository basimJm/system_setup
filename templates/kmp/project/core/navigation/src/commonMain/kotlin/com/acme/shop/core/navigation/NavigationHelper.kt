package com.acme.shop.core.navigation

import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController

fun NavController.setResult(key: String, result: Any) {
    this.previousBackStackEntry?.savedStateHandle?.set(key, result)
}

inline fun <reified T> NavBackStackEntry.getResult(
    key: String,
    consume: Boolean = true,
): T? {
    val value = savedStateHandle.get<T>(key)
    if (consume && value != null) {
        savedStateHandle.set<T?>(key, null)
    }
    return value
}
