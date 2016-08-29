import Html exposing (Attribute, button, div, text, Html)
import Html.Attributes exposing (style)
import Html.App exposing (program)
import Html.Events exposing (on, onClick)
import Json.Decode exposing (succeed)

type Msg = Click (Int, Int)
type alias Model = {coords : (Int, Int)}

--import Html.App exposing (beginnerProgram)
--main = program {model = 0, view = view, update = update}

main =
  program {
    init = init,
    view = view,
    update = update,
    subscriptions = subscriptions
  }

subscriptions : Model -> Sub Msg
subscriptions _ = Sub.none

init = ({coords = (20, 0)}, Cmd.none)

onClickPosition : Attribute Msg
onClickPosition =
  on "click" (succeed (Click (50, 50)))

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
        ("position", "absolute"),
        ("left", toString x ++ "px"),
        ("top", toString y ++ "px")
      ]] [ text "x"]
    ]

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    Click coords ->
      ({model | coords = coords}, Cmd.none)
