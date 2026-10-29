package com.acme.shop.core.domain.enums

enum class ItemType(val value: String) {
    BY_WEIGHT("by_weight"),
    BY_PIECE("by_piece");

    companion object {
        fun fromValue(value: String?): ItemType? {
            return when (value) {
                "by_weight" -> ItemType.BY_WEIGHT
                "by_piece" -> ItemType.BY_PIECE
                else -> null
            }
        }
    }
}
