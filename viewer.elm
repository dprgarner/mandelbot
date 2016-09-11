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
  topLeft : (Float, Float), -- Coordinates of top left in complex space
  level : Int,              -- Zoom level
  depth : Int               -- Maximum number of z->z^2+c iterations performed per pixel
}

type Msg = MoveZoom (Int, Int)
         | ZoomIn
         | SetDepth Int
         | ZoomOut

--
-- Setup
--

viewWidth : Int -- Width of the view box in pixels
viewWidth = 512

viewHeight : Int -- Height of the view box in pixels
viewHeight = 512

zoomFactor : Int -- Relative size of the zoom box to the viewport
zoomFactor = 2

initialScale : Float -- Initial ratio of pixel space to complex space
initialScale = 1/128

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
  topLeft = (-2.5, 2),
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

zoomIn : (Int, Int) -> Snapshot -> Snapshot
zoomIn (boundedMouseX, boundedMouseY) snapshot =
  let
    (complexX, complexY) = snapshot.topLeft
    scale = getScale snapshot.level
    newX = complexX + scale * toFloat (boundedMouseX - zoomWidth // 2)
    newY = complexY - scale * toFloat (boundedMouseY - zoomHeight // 2)
  in
    {snapshot |
    topLeft = (newX, newY),
    level = snapshot.level + 1
    }

zoomOut : (Int, Int) -> Snapshot -> Snapshot
zoomOut (boundedMouseX, boundedMouseY) snapshot =
  let
    (complexX, complexY) = snapshot.topLeft
    oldScale = getScale snapshot.level
    newScale = getScale (snapshot.level - 1)
    newX = complexX + oldScale * toFloat boundedMouseX - toFloat viewWidth * newScale / 2
    newY = complexY - oldScale * toFloat boundedMouseY + toFloat viewHeight * newScale / 2
  in
    {snapshot |
    topLeft = (newX, newY),
    level = snapshot.level - 1
    }

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  let
    newSnapshot : Model -> Snapshot -> (Model, Cmd Msg)
    newSnapshot model snapshot =
      {model | snapshot = snapshot, slides = snapshot :: model.slides} ! []
  in
    case msg of
      MoveZoom coords ->
        {model | hoverCoords = coords} ! []
      SetDepth depth ->
        (\snapshot -> {snapshot | depth = depth}) model.snapshot
          |> newSnapshot model
      ZoomIn ->
        zoomIn (boundedCoords model.hoverCoords) model.snapshot
          |> newSnapshot model
      ZoomOut ->
        zoomOut (boundedCoords model.hoverCoords) model.snapshot
          |> newSnapshot model

--
-- View
--

px : Int -> String
px i = toString i ++ "px"

getUrl : Snapshot -> String
getUrl snapshot =
  let
    (topX, topY) = snapshot.topLeft
    scale = getScale snapshot.level
    x = topX + scale * toFloat viewWidth / 2
    y = topY - scale * toFloat viewHeight / 2
  in
    "/api/?"
    ++ "&width=" ++ toString viewWidth
    ++ "&height=" ++ toString viewHeight
    ++ "&x=" ++ toString x
    ++ "&y=" ++ toString y
    ++ "&depth=" ++ toString snapshot.depth
    ++ "&scale=" ++ toString scale

decodeOffset : Decoder (Int, Int)
decodeOffset =
  (Json.object2 (,) ("offsetX" := Json.int) ("offsetY" := Json.int))

onRightClick : msg -> Attribute msg
onRightClick msg =
  onWithOptions "contextmenu" (Options True True) (Json.succeed msg)

viewSlides : Model -> List (Html Msg)
viewSlides model =
  List.map (\snapshot ->
    let
      dlevel = model.snapshot.level - snapshot.level
      resizeFactor = zoomFactor ^ dlevel
      (mX, mY) = model.snapshot.topLeft
      (sX, sY) = snapshot.topLeft
      scale = getScale model.snapshot.level
    in
      img [
        Attr.src (getUrl snapshot),
        Attr.class "slide",
        Attr.style [
          ("left", px <| round <| (sX - mX) / scale),
          ("top", px <| round <| (mY - sY) / scale),
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
      Attr.class "viewer",
      Attr.style [
        ("width", px viewWidth),
        ("height", px viewHeight)
      ],
      on "mousemove" (Json.map MoveZoom decodeOffset),
      onClick ZoomIn,
      onRightClick ZoomOut
    ] (List.reverse (
      div [
        Attr.class "zoom-box",
        Attr.style [
          ("left", px zoomBoxX),
          ("top", px zoomBoxY),
          ("width", px zoomWidth),
          ("height", px zoomHeight)
        ]
      ] []
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

viewSnapshotInfo : Snapshot -> Html Msg
viewSnapshotInfo snapshot =
  let
    (tX, tY) = snapshot.topLeft
  in
    div [Attr.class "snapshot-info-li"] [
      div [] [text ("topLeft: " ++ toString tX ++ " + " ++ toString tY ++ "i")],
      div [] [text ("zoom level: " ++ toString snapshot.level)]
    ]

viewSidebar : Model -> Html Msg
viewSidebar model =
  div [Attr.class "sidebar"] [
    viewSlider model.snapshot.depth,
    viewSnapshotInfo model.snapshot,
    div [Attr.class "snapshot-info-ul"] (List.map viewSnapshotInfo model.slides)
  ]

view : Model -> Html Msg
view model =
  div [Attr.class "elm-container"] [
    div [Attr.class "viewer-container"] [viewZoomBox model],
    viewSidebar model
  ]