import Html exposing (Attribute, div, text, Html)
import Html.App exposing (program)
import Html.Attributes exposing (style)
import Html.Events exposing (on)
import Json.Decode exposing ((:=), Decoder, int, map, object2)

type alias Model = {coords : (Int, Int)}
type Msg = Click (Int, Int)

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
init = ({coords = (0, 0)}, Cmd.none)

--
-- View
--

decodeOffset : Decoder (Int, Int)
decodeOffset =
  (object2 (,) ("offsetX" := int) ("offsetY" := int))

onClickPosition : Attribute Msg
onClickPosition =
  on "mousemove" (map Click decodeOffset)

view : Model -> Html Msg
view model =
  let
    (x,y) = model.coords
  in
    div [
      style [
        ("background-color", "red"),
        ("width", "200px"),
        ("height", "200px")
      ],
      onClickPosition
    ] [
      div [style [
        ("pointer-events", "none"),
        ("position", "absolute"),
        ("left", toString x ++ "px"),
        ("top", toString y ++ "px")
      ]] [ text "x"]
    ]

--
-- Update
--

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    Click coords ->
      ({model | coords = coords}, Cmd.none)

--
-- Subscriptions
--

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none
