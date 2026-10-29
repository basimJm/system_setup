package com.acme.shop.designsystem.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.theme.LightColors

/** The design's own 24-unit line icons (`IC` maps and inline SVGs of `design/0x *.dc.html`), rebuilt as vectors. */
@Suppress("LargeClass", "TooManyFunctions") // one val per design icon, generated from the SVG paths
internal object DesignIcons {
    val Back: ImageVector by lazy { icon("Back", STROKE_BOLD, true, DesignIconPaths.BACK) }
    val Forward: ImageVector by lazy { icon("Forward", STROKE_BOLD, true, DesignIconPaths.FORWARD) }
    val Check: ImageVector by lazy { icon("Check", STROKE_CHECK, false, DesignIconPaths.CHECK) }
    val Search: ImageVector by lazy { icon("Search", STROKE_BOLD, false, DesignIconPaths.SEARCH) }
    val Filter: ImageVector by lazy { icon("Filter", STROKE_BOLD, false, DesignIconPaths.FILTER) }
    val Home: ImageVector by lazy { icon("Home", STROKE, false, DesignIconPaths.HOME) }
    val FavoriteBorder: ImageVector by lazy { icon("FavoriteBorder", STROKE_BOLD, false, DesignIconPaths.FAVORITE_BORDER) }
    val Favorite: ImageVector by lazy { icon("Favorite", null, false, DesignIconPaths.FAVORITE) }
    val Calendar: ImageVector by lazy { icon("Calendar", STROKE, false, DesignIconPaths.CALENDAR) }
    val Profile: ImageVector by lazy { icon("Profile", STROKE, false, DesignIconPaths.PROFILE) }
    val Notifications: ImageVector by lazy { icon("Notifications", STROKE, false, DesignIconPaths.NOTIFICATIONS) }
    val Star: ImageVector by lazy { icon("Star", null, false, DesignIconPaths.STAR) }
    val StarBorder: ImageVector by lazy { icon("StarBorder", STROKE, false, DesignIconPaths.STAR_BORDER) }
    val Call: ImageVector by lazy { icon("Call", STROKE, false, DesignIconPaths.CALL) }
    val Share: ImageVector by lazy { icon("Share", STROKE, false, DesignIconPaths.SHARE) }
    val Info: ImageVector by lazy { icon("Info", STROKE_BOLD, false, DesignIconPaths.INFO) }
    val Error: ImageVector by lazy { icon("Error", STROKE_THIN, false, DesignIconPaths.ERROR) }
    val Offline: ImageVector by lazy { icon("Offline", STROKE_THIN, false, DesignIconPaths.OFFLINE) }
    val ExpandMore: ImageVector by lazy { icon("ExpandMore", STROKE_CHEVRON, false, DesignIconPaths.EXPAND_MORE) }
    val ExpandLess: ImageVector by lazy { icon("ExpandLess", STROKE_CHEVRON, false, DesignIconPaths.EXPAND_LESS) }
    val Play: ImageVector by lazy { icon("Play", null, false, DesignIconPaths.PLAY) }
    val Pause: ImageVector by lazy { icon("Pause", null, false, DesignIconPaths.PAUSE) }
    val Chat: ImageVector by lazy { icon("Chat", STROKE, false, DesignIconPaths.CHAT) }
    val Location: ImageVector by lazy { icon("Location", STROKE_BOLD, false, DesignIconPaths.LOCATION) }
    val LocationOff: ImageVector by lazy { icon("LocationOff", STROKE_BOLD, false, DesignIconPaths.LOCATION_OFF) }
    val Image: ImageVector by lazy { icon("Image", STROKE, false, DesignIconPaths.IMAGE) }
    val Gallery: ImageVector by lazy { icon("Gallery", STROKE, false, DesignIconPaths.GALLERY) }
    val Edit: ImageVector by lazy { icon("Edit", STROKE_PENCIL, false, DesignIconPaths.EDIT) }
    val Delete: ImageVector by lazy { icon("Delete", STROKE, false, DesignIconPaths.DELETE) }
    val Email: ImageVector by lazy { icon("Email", STROKE, false, DesignIconPaths.EMAIL) }
    val Camera: ImageVector by lazy { icon("Camera", STROKE, false, DesignIconPaths.CAMERA) }
    val Help: ImageVector by lazy { icon("Help", STROKE, false, DesignIconPaths.HELP) }
    val Legal: ImageVector by lazy { icon("Legal", STROKE, false, DesignIconPaths.LEGAL) }
    val Shield: ImageVector by lazy { icon("Shield", STROKE, false, DesignIconPaths.SHIELD) }
    val Business: ImageVector by lazy { icon("Business", STROKE, false, DesignIconPaths.BUSINESS) }
    val Language: ImageVector by lazy { icon("Language", STROKE, false, DesignIconPaths.LANGUAGE) }
    val ThemeDark: ImageVector by lazy { icon("ThemeDark", STROKE, false, DesignIconPaths.THEME_DARK) }
    val ThemeLight: ImageVector by lazy { icon("ThemeLight", STROKE, false, DesignIconPaths.THEME_LIGHT) }
    val Device: ImageVector by lazy { icon("Device", STROKE_LIGHT, false, DesignIconPaths.DEVICE) }
    val Tag: ImageVector by lazy { icon("Tag", STROKE, false, DesignIconPaths.TAG) }
    val NotificationsOff: ImageVector by lazy { icon("NotificationsOff", STROKE, false, DesignIconPaths.NOTIFICATIONS_OFF) }
    val Clock: ImageVector by lazy { icon("Clock", STROKE_BOLD, false, DesignIconPaths.CLOCK) }
    val Download: ImageVector by lazy { icon("Download", STROKE_PENCIL, false, DesignIconPaths.DOWNLOAD) }
    val Map: ImageVector by lazy { icon("Map", STROKE_BOLD, false, DesignIconPaths.MAP) }
    val Lock: ImageVector by lazy { icon("Lock", STROKE, false, DesignIconPaths.LOCK) }
    val Companions: ImageVector by lazy { icon("Companions", STROKE, false, DesignIconPaths.COMPANIONS) }
    val Person: ImageVector by lazy { icon("Person", STROKE, false, DesignIconPaths.PERSON) }
    val AddPerson: ImageVector by lazy { icon("AddPerson", STROKE, false, DesignIconPaths.ADD_PERSON) }
    val Avatar: ImageVector by lazy { icon("Avatar", null, false, DesignIconPaths.AVATAR) }

    private fun icon(name: String, strokeWidth: Float?, mirrored: Boolean, paths: List<String>): ImageVector {
        val builder = ImageVector.Builder(
            name = name,
            defaultWidth = SIZE.dp,
            defaultHeight = SIZE.dp,
            viewportWidth = SIZE,
            viewportHeight = SIZE,
            autoMirror = mirrored,
        )
        paths.forEach { data ->
            val nodes = PathParser().parsePathString(data).toNodes()
            if (strokeWidth == null) {
                builder.addPath(nodes, fill = SolidColor(TINT))
            } else {
                builder.addPath(
                    nodes,
                    stroke = SolidColor(TINT),
                    strokeLineWidth = strokeWidth,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            }
        }
        return builder.build()
    }

    private const val SIZE = 24f
    /** Icons are tinted by `Icon`; the base colour never shows. */
    private val TINT = LightColors.ink
    private const val STROKE_THIN = 1.5f
    private const val STROKE_PENCIL = 1.6f
    private const val STROKE_LIGHT = 1.7f
    private const val STROKE = 1.8f
    private const val STROKE_BOLD = 2f
    private const val STROKE_CHEVRON = 2.2f
    private const val STROKE_CHECK = 2.4f
}
