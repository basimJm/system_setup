package com.acme.shop.designsystem.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.plex_arabic_bold
import com.acme.shop.designsystem.resources.plex_arabic_medium
import com.acme.shop.designsystem.resources.plex_arabic_regular
import com.acme.shop.designsystem.resources.plex_arabic_semibold
import com.acme.shop.designsystem.resources.playfair_bold
import com.acme.shop.designsystem.resources.playfair_semibold
import com.acme.shop.designsystem.resources.poppins_bold
import com.acme.shop.designsystem.resources.poppins_medium
import com.acme.shop.designsystem.resources.poppins_regular
import com.acme.shop.designsystem.resources.poppins_semibold
import org.jetbrains.compose.resources.Font

@Immutable
data class AppFontFamilies(val headline: FontFamily, val body: FontFamily)

/** Bundled font files only (composeResources/font); Arabic uses IBM Plex Sans Arabic for headings and body. */
@Composable
fun rememberAppFontFamilies(arabic: Boolean): AppFontFamilies {
    val plexRegular = Font(Res.font.plex_arabic_regular, FontWeight.Normal)
    val plexMedium = Font(Res.font.plex_arabic_medium, FontWeight.Medium)
    val plexSemiBold = Font(Res.font.plex_arabic_semibold, FontWeight.SemiBold)
    val plexBold = Font(Res.font.plex_arabic_bold, FontWeight.Bold)
    val poppinsRegular = Font(Res.font.poppins_regular, FontWeight.Normal)
    val poppinsMedium = Font(Res.font.poppins_medium, FontWeight.Medium)
    val poppinsSemiBold = Font(Res.font.poppins_semibold, FontWeight.SemiBold)
    val poppinsBold = Font(Res.font.poppins_bold, FontWeight.Bold)
    val playfairSemiBold = Font(Res.font.playfair_semibold, FontWeight.SemiBold)
    val playfairBold = Font(Res.font.playfair_bold, FontWeight.Bold)
    return remember(arabic, plexRegular, poppinsRegular, playfairBold) {
        if (arabic) {
            val plex = FontFamily(plexRegular, plexMedium, plexSemiBold, plexBold)
            AppFontFamilies(headline = plex, body = plex)
        } else {
            AppFontFamilies(
                headline = FontFamily(playfairSemiBold, playfairBold),
                body = FontFamily(poppinsRegular, poppinsMedium, poppinsSemiBold, poppinsBold),
            )
        }
    }
}
