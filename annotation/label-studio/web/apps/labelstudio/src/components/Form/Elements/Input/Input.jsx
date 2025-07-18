import { cn } from "../../../../utils/bem";
import { FormField } from "../../FormField";
import { default as Label } from "../Label/Label";
import "./Input.scss";

const Input = ({
  label,
  description,
  footer,
  className,
  validate,
  required,
  skip,
  labelProps,
  ghost,
  tooltip,
  tooltipIcon,
  ...props
}) => {
  const classList = [cn("input-ls").mod({ ghost }), className].join(" ").trim();

  const input = (
    <FormField label={label} name={props.name} validate={validate} required={required} skip={skip} {...props}>
      {(ref) => <input {...props} ref={ref} className={classList} />}
    </FormField>
  );

  return label ? (
    <Label
      {...(labelProps ?? {})}
      description={description}
      footer={footer}
      text={label}
      tooltip={tooltip}
      tooltipIcon={tooltipIcon}
      required={required}
    >
      {input}
    </Label>
  ) : (
    input
  );
};

export default Input;
