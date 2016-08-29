import Html exposing (Attribute, div, text, Html)
import Html.App exposing (program)
import Html.Attributes exposing (style)
import Html.Events exposing (on, onClick)
import Json.Decode exposing ((:=), Decoder, int, map, object2)

type alias Model = {
  zoomCoords : (Int, Int),
  chosenCoords : (Int, Int)
}
type Msg = Move (Int, Int) | Click

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
init =
  ({zoomCoords = (0, 0), chosenCoords = (50, 50)}, Cmd.none)

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

onMovePosition : Attribute Msg
onMovePosition =
  on "mousemove" (map Move decodeOffset)

boundedCoords : (Int, Int) -> (Int, Int)
boundedCoords (x, y) =
  let
    newX = max (zoomWidth // 2) (min (viewWidth - zoomWidth // 2) x)
    newY = max (zoomHeight // 2) (min (viewHeight - zoomHeight // 2) y)
  in
    (newX, newY)

px : Int -> String
px i = toString i ++ "px"

view : Model -> Html Msg
view model =
  let
    (x, y) = boundedCoords model.zoomCoords
    (topX, topY) = (x - zoomWidth // 2, y - zoomHeight // 2)
    (chosenX, chosenY) = model.chosenCoords
  in
    div [] [
      div [
        style [
          ("background-color", "red"),
          ("border", "1px solid black"),
          --("cursor", "none"),
          ("width", px viewWidth),
          ("height", px viewHeight)
        ],
        onMovePosition,
        onClick Click
      ] [
        div [style [
          ("position", "absolute"),
          ("left", px topX),
          ("top", px topY),
          ("width", px zoomWidth),
          ("height", px zoomHeight),
          ("pointer-events", "none"),
          ("border", "1px solid black")
        ]] []
      ],

      div [style [
        ("position", "absolute"),
        ("left", px 50),
        ("top", px (viewHeight + 50)),
        ("width", px zoomWidth),
        ("height", px zoomHeight)
      ]] [
        text ("(" ++ toString chosenX ++ "," ++ toString chosenY ++ ")")
      ]
    ]

--
-- Update
--

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    Move coords ->
      ({model | zoomCoords = coords}, Cmd.none)
    Click ->
      ({model | chosenCoords = boundedCoords model.zoomCoords}, Cmd.none)

--
-- Subscriptions
--

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none
