use serde_json::Value;

pub fn proto_value_to_json(v: Option<prost_types::Value>) -> Value {
    fn convert_value(v: prost_types::Value) -> Value {
        use prost_types::value::Kind;
        match v.kind {
            Some(Kind::NullValue(_)) => Value::Null,
            Some(Kind::NumberValue(n)) => serde_json::Number::from_f64(n)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            Some(Kind::StringValue(s)) => Value::String(s),
            Some(Kind::BoolValue(b)) => Value::Bool(b),
            Some(Kind::StructValue(sv)) => {
                let mut map = serde_json::Map::new();
                for (k, v) in sv.fields.into_iter() {
                    map.insert(k, convert_value(v));
                }
                Value::Object(map)
            }
            Some(Kind::ListValue(lv)) => {
                let arr = lv.values.into_iter().map(convert_value).collect();
                Value::Array(arr)
            }
            None => Value::Null,
        }
    }

    match v {
        Some(val) => convert_value(val),
        None => Value::Null,
    }
}
