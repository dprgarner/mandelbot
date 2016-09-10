import Html exposing (Attribute, div, Html, img, input, text)
import Html.App exposing (program)
import Html.Attributes as Attr
import Html.Events exposing (on, onClick, onWithOptions, Options)
import Json.Decode exposing ((:=), Decoder)
import Json.Decode as Json
import String exposing (toInt)

type alias Model = {
  hoverCoords : (Int, Int),
  snapshot : Snapshot,
  slides : List Snapshot
}

type alias Snapshot = {
  centre : (Float, Float),
  level : Int,
  depth : Int
}

type Msg = MoveZoom (Int, Int)
         | ZoomIn
         | SetDepth Int
         | ZoomOut

--
-- Setup
--

zoomFactor : Int
zoomFactor = 3

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

initialSnapshot : Snapshot
initialSnapshot = {
  centre = (-0.5, 0),
  level = 0,
  depth = 100
  }

init : (Model, Cmd Msg)
init = {
  hoverCoords = (viewWidth // 2, viewHeight // 2),
  snapshot = initialSnapshot,
  slides = [initialSnapshot]
  } ! []

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none

--
-- Update
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

getComplexCentre : (Int, Int) -> Snapshot -> (Float, Float)
getComplexCentre hoverCoords snapshot =
  let
    (nX, nY) = boundedCoords hoverCoords
    (cX, cY) = snapshot.centre
    s = getScale snapshot.level
  in
    (cX + s * toFloat (nX - viewWidth // 2), cY + s * toFloat (viewHeight // 2 - nY))

setDepth : Int -> Snapshot -> Snapshot
setDepth depth snapshot = {snapshot | depth = depth}

zoomTo : (Float, Float) -> Int -> Snapshot -> Snapshot
zoomTo centre dlevel snapshot = {snapshot |
  centre = centre,
  level = snapshot.level + dlevel
  }

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    MoveZoom coords ->
      ({model | hoverCoords = coords}, Cmd.none)
    SetDepth depth ->
      let snapshot = setDepth depth model.snapshot in
      ({model | snapshot = snapshot, slides = snapshot :: model.slides}, Cmd.none)
    ZoomIn ->
      let
        newCentre = getComplexCentre model.hoverCoords model.snapshot
        snapshot = zoomTo newCentre 1 model.snapshot
      in
        ({model | snapshot = snapshot, slides = snapshot :: model.slides}, Cmd.none)
    ZoomOut ->
      let
        newCentre = getComplexCentre model.hoverCoords model.snapshot
        snapshot = zoomTo newCentre (-1) model.snapshot
      in
        ({model | snapshot = snapshot, slides = snapshot :: model.slides}, Cmd.none) 

--
-- View
--

px : Int -> String
px i = toString i ++ "px"

getUrl : Snapshot -> String
getUrl snapshot =
  let
    (x,y) = snapshot.centre
  in
    "/api/?"
    ++ "&width=" ++ toString viewWidth
    ++ "&height=" ++ toString viewHeight
    ++ "&x=" ++ toString x
    ++ "&y=" ++ toString y
    ++ "&depth=" ++ toString snapshot.depth
    ++ "&scale=" ++ toString (getScale snapshot.level)

decodeOffset : Decoder (Int, Int)
decodeOffset =
  (Json.object2 (,) ("offsetX" := Json.int) ("offsetY" := Json.int))

onRightClick : msg -> Attribute msg
onRightClick msg =
  onWithOptions "contextmenu" (Options True True) (Json.succeed msg)

topLeftCornerOffsetHelper : Int -> Int -> Int
topLeftCornerOffsetHelper boxDimension centreCoord =
  centreCoord + boxDimension * (zoomFactor - 1) // (2 * zoomFactor)

viewSlides : Model -> List (Html Msg)
viewSlides model =
  List.map (\snapshot ->
    let
      dlevel = model.snapshot.level - snapshot.level
      resizeFactor = zoomFactor ^ dlevel
      (mX, mY) = model.snapshot.centre
      (sX, sY) = snapshot.centre
    in
      img [
        Attr.src (getUrl snapshot),
        Attr.style [
          ("position", "absolute"),
          ("pointer-events", "none"),
          --("left", px -(topLeftCornerOffsetHelper viewWidth cX)),
          --("top", px -(topLeftCornerOffsetHelper viewHeight cY)),
          ("width", px (viewWidth * resizeFactor)),
          ("height", px (viewHeight * resizeFactor))
        ]
        --on "load" (Json.succeed Loaded)
      ] []
  ) model.slides

viewZoomBox : Model -> Html Msg
viewZoomBox model =
  let
    (mouseX, mouseY) = boundedCoords model.hoverCoords
    (zoomBoxX, zoomBoxY) = (mouseX - zoomWidth // 2, mouseY - zoomHeight // 2)
  in
    div [
      Attr.style [
        ("border", "1px solid black"),
        ("cursor", "pointer"),
        ("display", "inline-block"),
        ("float", "left"),
        ("position", "relative"),
        --("overflow", "hidden"),
        ("width", px viewWidth),
        ("height", px viewHeight)
      ],
      on "mousemove" (Json.map MoveZoom decodeOffset),
      onClick ZoomIn,
      onRightClick ZoomOut
    ] (List.reverse (
      div [Attr.style [
        ("border", "1px solid black"),
        ("pointer-events", "none"),
        ("position", "absolute"),
        ("left", px zoomBoxX),
        ("top", px zoomBoxY),
        ("width", px zoomWidth),
        ("height", px zoomHeight)
      ]] []
    :: viewSlides model))

decodeRangeValue : Decoder Int
decodeRangeValue =
  let
    decodeStringValue = Json.at ["currentTarget", "value"] Json.string
  in
    Json.customDecoder decodeStringValue toInt

viewSlider : Int -> Html Msg
viewSlider depth =
  div [] [
    div [] [text ("Depth (# of iterations): " ++ toString depth)],
    input [
      Attr.type' "range",
      Attr.min "25",
      Attr.max "2000",
      Attr.step "25",
      Attr.value (toString depth),
      on "change" (Json.map SetDepth decodeRangeValue)
    ] []
  ]

viewInfo : Snapshot -> Html Msg
viewInfo snapshot =
  let
    (cX, cY) = snapshot.centre
  in
    div [Attr.style [("border-bottom", "1px solid black")]] [
      div [] [text ("centre: " ++ toString cX ++ " + " ++ toString cY ++ "i")],
      --div [] [text ("scale: 1px = " ++ toString (getScale snapshot.level))],
      div [] [text ("zoom level: " ++ toString snapshot.level)]
    ]

view : Model -> Html Msg
view model =
  div [Attr.style [
      ("display", "inline-block"),
      ("padding", "250px 250px")
    ]] [
    viewZoomBox model,
    div [Attr.style [
      ("display", "inline-block"),
      ("padding-left", px 50)
    ]] [
      viewSlider model.snapshot.depth,
      viewInfo model.snapshot,
      div [Attr.style [
        ("display", "inline-block"),
        ("padding-left", px 200)
      ]] (List.map viewInfo model.slides)
    ]
  ]
