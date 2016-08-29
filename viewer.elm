import Html exposing (Attribute, div, text, Html)
import Html.App exposing (program)
import Html.Attributes exposing (style)
import Html.Events exposing (on)
import Json.Decode exposing ((:=), Decoder, int, map, object2)

type alias Model = {mouseCoords : (Int, Int)}
type Msg = Move (Int, Int)

--
-- Setup
--

main =
  program {
    init = init,
    view = view,
    update = update,
    subscriptions = subscriptions
  }

init : (Model, Cmd Msg)
init = ({mouseCoords = (0, 0)}, Cmd.none)

--
-- View
--

viewWidth : Int
viewWidth = 300

viewHeight : Int
viewHeight = 300

zoomWidth : Int
zoomWidth = 150

zoomHeight : Int
zoomHeight = 150

decodeOffset : Decoder (Int, Int)
decodeOffset =
  (object2 (,) ("offsetX" := int) ("offsetY" := int))

onClickPosition : Attribute Msg
onClickPosition =
  on "mousemove" (map Move decodeOffset)

topLeftCoords : (Int, Int) -> (Int, Int)
topLeftCoords (x, y)
  = (max (x - zoomWidth // 2) 0, max (y - zoomHeight // 2) 0)

bottomRightCoords : (Int, Int) -> (Int, Int)
bottomRightCoords (x, y)
  = (min (x + zoomWidth // 2) viewWidth, min (y + zoomHeight // 2) viewHeight)

px : Int -> String
px i = toString i ++ "px"

view : Model -> Html Msg
view model =
  let
    (topX, topY) = topLeftCoords model.mouseCoords
    (bottomX, bottomY) = bottomRightCoords model.mouseCoords
    w = bottomX - topX
    h = bottomY - topY
  in
    div [
      style [
        ("background-color", "red"),
        ("border", "1px solid black"),
        --("cursor", "none"),
        ("width", px viewWidth),
        ("height", px viewHeight)
      ],
      onClickPosition
    ] [
      div [style [
        ("position", "absolute"),
        ("left", px topX),
        ("top", px topY),
        ("width", px w),
        ("height", px h),
        ("pointer-events", "none"),
        ("border", "1px solid black")
      ]] []
    ]

--
-- Update
--

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    Move coords ->
      ({model | mouseCoords = coords}, Cmd.none)

--
-- Subscriptions
--

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none
