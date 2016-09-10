import Html exposing (Attribute, div, Html, img, input, text)
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
  depth : Int,
  loaded : Bool
}

type Msg = MoveZoom (Int, Int)
         | ZoomIn
         | SetDepth Int
         | ZoomOut
         | Loaded

--
-- Setup
--

zoomFactor : Int
zoomFactor = 2

viewWidth : Int
viewWidth = 512

viewHeight : Int
viewHeight = 512

initialScale : Float
initialScale = 1/256

getScale : Int -> Float
getScale level =
  initialScale / toFloat (zoomFactor^level)

zoomWidth : Int
zoomWidth = round (toFloat viewWidth / toFloat zoomFactor)

zoomHeight : Int
zoomHeight = round (toFloat viewHeight / toFloat zoomFactor)

main =
  program {
    init = init,
    view = view,
    update = update,
    subscriptions = subscriptions
  }

init : (Model, Cmd Msg)
init = {
  hoverCoords = (viewWidth // 2, viewHeight // 2),
  centre = (-0.5, 0),
  level = 0,
  depth = 100,
  loaded = False
  } ! []

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none

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
      ({model |
        centre = getComplexCentre model,
        level = model.level + 1,
        loaded = False
       }, Cmd.none)
    ZoomOut ->
      ({model |
        level = model.level - 1,
        loaded = False
       }, Cmd.none)
    Loaded ->
      ({model | loaded = True}, Cmd.none)

--
-- View
--

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

decodeOffset : Decoder (Int, Int)
decodeOffset =
  (Json.object2 (,) ("offsetX" := Json.int) ("offsetY" := Json.int))

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
        ("border", "1px solid black"),
        ("cursor", "pointer"),
        ("display", "inline-block"),
        ("float", "left"),
        ("position", "relative"),
        ("width", px viewWidth),
        ("height", px viewHeight)
      ],
      on "mousemove" (Json.map MoveZoom decodeOffset),
      onClick ZoomIn,
      onRightClick ZoomOut
    ] [
      div [Attr.style [
        ("position", "absolute"),
        ("left", px topX),
        ("top", px topY),
        ("width", px zoomWidth),
        ("height", px zoomHeight),
        ("pointer-events", "none"),
        ("border", "1px solid black")
      ]] [],
      img [
        Attr.src (getUrl model),
        --Attr.style (if model.loaded then [] else [("background-color", "pink")]),
        on "load" (Json.succeed Loaded)
      ] []
    ]

decodeRangeValue : Decoder Int
decodeRangeValue =
  let
    decodeStringValue = Json.at ["currentTarget", "value"] Json.string
  in
    Json.customDecoder decodeStringValue toInt

viewSlider : Model -> Html Msg
viewSlider model =
  div [] [
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
    isLoaded =
      if model.loaded then
        "Yes"
      else
        "No"
  in
    div [] [
      div [] [text ("centre: " ++ toString cX ++ " + " ++ toString cY ++ "i")],
      div [] [text ("scale: 1px = " ++ toString (getScale model.level))],
      div [] [text ("zoom level: " ++ toString model.level)],
      div [] [text ("loaded:" ++ isLoaded)]
    ]

view : Model -> Html Msg
view model =
  div [] [
    viewBox model,
    div [Attr.style [
      ("display", "inline-block"),
      ("padding-left", px 50)
    ]] [
      viewSlider model,
      viewInfo model
    ]
  ]
