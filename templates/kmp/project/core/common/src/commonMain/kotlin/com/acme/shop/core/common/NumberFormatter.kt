package com.acme.shop.core.common

import kotlin.math.pow
import kotlin.math.round

object NumberFormatter {
    fun formatDecimal(value: Double, decimals: Int = 2): String {
        if (value.isNaN()) return "0"
        if (value == Double.POSITIVE_INFINITY) return "∞"
        if (value == Double.NEGATIVE_INFINITY) return "-∞"
        
        val multiplier = 10.0.pow(decimals)
        val shifted = round(value * multiplier)
        val result = shifted / multiplier
        return if (decimals > 0) {
            val intPart = result.toLong()
            val fracPart = ((result - intPart) * multiplier).toLong()
            "$intPart.${fracPart.toString().padStart(decimals, '0')}"
        } else {
            result.toLong().toString()
        }
    }
    
    fun formatCurrency(value: Double): String = formatDecimal(value, 2)
}
