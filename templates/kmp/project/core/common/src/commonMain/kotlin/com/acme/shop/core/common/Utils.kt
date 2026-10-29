package com.acme.shop.core.common

object Utils {
    fun formatPrice(price: Double): String {
        val rounded = kotlin.math.round(price * 100) / 100.0
        val parts = rounded.toString().split(".")
        val whole = parts[0]
        val decimal = if (parts.size > 1) parts[1].padEnd(2, '0').take(2) else "00"
        return "$whole.$decimal"
    }

    fun formatWeight(weight: Double): String {
        val rounded = kotlin.math.round(weight * 10) / 10.0
        val str = rounded.toString()
        return str
    }

    fun formatNumberCompact(value: Double): String {
        fun format(num: Double) = (num * 10).toInt() / 10.0

        return when {
            value >= 1_000_000_000 ->
                "${format(value / 1_000_000_000.0)}B"

            value >= 1_000_000 ->
                "${format(value / 1_000_000.0)}M"

            value >= 1_000 ->
                "${format(value / 1_000.0)}K"

            else -> value.toString()
        }
    }
}
