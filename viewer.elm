import Html exposing (Attribute, div, Html, input, text)
import Html.App exposing (program)
import Html.Attributes as Attr
import Html.Events exposing (on, onClick, onWithOptions, Options)
import Json.Decode exposing ((:=), Decoder)
import Json.Decode as Json
import String exposing (toInt)

type alias Model = {
  hoverCoords : (Int, Int),
  centre : (Float, Float),
  level : Int,
  depth : Int
}
type Msg = MoveZoom (Int, Int) | ZoomIn | SetDepth Int | ZoomOut

--
-- Setup
--

zoomFactor : Float
zoomFactor = 2

viewWidth : Int
viewWidth = 512

viewHeight : Int
viewHeight = 512

initialScale : Float
initialScale = 1/128

getScale : Int -> Float
getScale level =
  initialScale / toFloat (2^level)

zoomWidth : Int
zoomWidth = round (toFloat viewWidth / zoomFactor)

zoomHeight : Int
zoomHeight = round (toFloat viewHeight / zoomFactor)

main =
  program {
    init = init,
    view = view,
    update = update,
    subscriptions = subscriptions
  }

init : (Model, Cmd Msg)
init =
  ({hoverCoords = (0, 0), centre = (-0.5, 0), level = 1, depth=100}, Cmd.none)

--
-- View
--

decodeOffset : Decoder (Int, Int)
decodeOffset =
  (Json.object2 (,) ("offsetX" := Json.int) ("offsetY" := Json.int))

decodeRangeValue : Decoder Int
decodeRangeValue =
  let
    decodeStringValue = Json.at ["currentTarget", "value"] Json.string
  in
    Json.customDecoder decodeStringValue toInt

boundedCoords : (Int, Int) -> (Int, Int)
boundedCoords (x, y) =
  let
    newX = x
      |> min (viewWidth - zoomWidth // 2)
      |> max (zoomWidth // 2)
    newY = y
      |> min (viewHeight - zoomHeight // 2)
      |> max (zoomHeight // 2)
  in
    (newX, newY)

px : Int -> String
px i = toString i ++ "px"

getUrl : Model -> String
getUrl model =
  let
    (x,y) = model.centre
  in
    "/api/?"
    ++ "&width=" ++ toString viewWidth
    ++ "&height=" ++ toString viewHeight
    ++ "&x=" ++ toString x
    ++ "&y=" ++ toString y
    ++ "&depth=" ++ toString model.depth
    ++ "&scale=" ++ toString (getScale model.level)

onRightClick : msg -> Attribute msg
onRightClick msg =
  onWithOptions "contextmenu" (Options True True) (Json.succeed msg)

viewBox : Model -> Html Msg
viewBox model =
  let
    (x, y) = boundedCoords model.hoverCoords
    (topX, topY) = (x - zoomWidth // 2, y - zoomHeight // 2)
  in
    div [
      Attr.style [
        ("background-image", "url(\"" ++ getUrl model ++ "\")"),
        ("border", "1px solid black"),
        ("cursor", "pointer"),
        ("position", "absolute"),
        ("width", px viewWidth),
        ("height", px viewHeight)
      ],
      on "mousemove" (Json.map MoveZoom decodeOffset),
      onRightClick ZoomOut,
      onClick ZoomIn
    ] [
      div [Attr.style [
        ("position", "absolute"),
        ("left", px topX),
        ("top", px topY),
        ("width", px zoomWidth),
        ("height", px zoomHeight),
        ("pointer-events", "none"),
        ("border", "1px solid black")
      ]] []
    ]

viewSlider : Model -> Html Msg
viewSlider model =
  div [Attr.style [
      ("position", "absolute"),
      ("left", px (viewWidth + 50)),
      ("width", px viewWidth)
  ]] [
    div [] [text ("Depth (# of iterations): " ++ toString model.depth)],
    input [
      Attr.type' "range",
      Attr.min "25",
      Attr.max "2000",
      Attr.step "25",
      Attr.value (toString model.depth),
      on "change" (Json.map SetDepth decodeRangeValue)
    ] []
  ]

viewInfo : Model -> Html Msg
viewInfo model =
  let
    (hX, hY) = model.hoverCoords
    (cX, cY) = model.centre
  in
    div [Attr.style [
      ("position", "absolute"),
      ("left", px (viewWidth + 50)),
      ("top", px 100),
      ("width", px viewWidth)
    ]] [
      div [] [text ("centre: " ++ toString cX ++ " + " ++ toString cY ++ "i")],
      div [] [text ("scale: 1px = " ++ toString (getScale model.level))],
      div [] [text ("zoom level: " ++ toString model.level)]
    ]

view : Model -> Html Msg
view model =
  div [] [viewBox model, viewSlider model, viewInfo model]

--
-- Update
--

getComplexCentre : Model -> (Float, Float)
getComplexCentre model =
  let
    (nX, nY) = boundedCoords model.hoverCoords
    (cX, cY) = model.centre
    s = getScale model.level
  in
    (cX + s * toFloat (nX - viewWidth // 2), cY + s * toFloat (viewHeight // 2 - nY))

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    MoveZoom coords ->
      ({model | hoverCoords = coords}, Cmd.none)
    SetDepth depth ->
      ({model | depth = depth}, Cmd.none)
    ZoomIn ->
      ({model | centre = getComplexCentre model, level = model.level + 1}, Cmd.none)
    ZoomOut ->
      ({model | level = model.level - 1}, Cmd.none)

--
-- Subscriptions
--

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none
