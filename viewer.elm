import Html exposing (Attribute, div, text, Html)
import Html.App exposing (program)
import Html.Attributes exposing (style)
import Html.Events exposing (on, onClick)
import Json.Decode exposing ((:=), Decoder, int, map, object2)

type alias Model = {
  hoverCoords : (Int, Int),
  center : (Float, Float),
  scale : Float
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
  ({hoverCoords = (0, 0), center = (-0.5, 0), scale = 1/128}, Cmd.none)

zoomFactor : Float
zoomFactor = 2

viewWidth : Int
viewWidth = 512

viewHeight : Int
viewHeight = 512

--
-- View
--

zoomWidth : Int
zoomWidth = round (toFloat viewWidth / zoomFactor)

zoomHeight : Int
zoomHeight = round (toFloat viewHeight / zoomFactor)

decodeOffset : Decoder (Int, Int)
decodeOffset =
  (object2 (,) ("offsetX" := int) ("offsetY" := int))

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
    (x,y) = model.center
    cap = 50
  in
    "/api/?"
    ++ "&width=" ++ toString viewWidth
    ++ "&height=" ++ toString viewHeight
    ++ "&x=" ++ toString x
    ++ "&y=" ++ toString y
    ++ "&cap=" ++ toString cap
    ++ "&scale=" ++ toString model.scale

viewBox : Model -> Html Msg
viewBox model =
  let
    (x, y) = boundedCoords model.hoverCoords
    (topX, topY) = (x - zoomWidth // 2, y - zoomHeight // 2)
  in
    div [
      style [
        ("background-image", "url(\"" ++ getUrl model ++ "\")"),
        ("border", "1px solid black"),
        ("cursor", "pointer"),
        ("width", px viewWidth),
        ("height", px viewHeight)
      ],
      on "mousemove" (map Move decodeOffset),
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
    ]

viewInfo : Model -> Html Msg
viewInfo model =
  let
    (hX, hY) = model.hoverCoords
    (cX, cY) = model.center
  in
    div [style [
      ("position", "absolute"),
      ("left", px (viewWidth + 50)),
      ("top", px 50),
      ("width", px zoomWidth),
      ("height", px zoomHeight)
    ]] [
      div [] [text ("center: " ++ toString cX ++ " + " ++ toString cY ++ "i")],
      div [] [text ("scale: 1px = " ++ toString model.scale)]
    ]

view : Model -> Html Msg
view model =
  div [] [viewBox model, viewInfo model]

--
-- Update
--

toComplexSpace : Model -> (Float, Float)
toComplexSpace model =
  let
    (nX, nY) = boundedCoords model.hoverCoords
    (cX, cY) = model.center
    s = model.scale
  in
    (cX + s * toFloat (nX - viewWidth // 2), cY + s * toFloat (viewHeight // 2 - nY))


update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    Move coords ->
      ({model | hoverCoords = coords}, Cmd.none)
    Click ->
      ({model | center = toComplexSpace model, scale = model.scale / zoomFactor}, Cmd.none)

--
-- Subscriptions
--

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none
