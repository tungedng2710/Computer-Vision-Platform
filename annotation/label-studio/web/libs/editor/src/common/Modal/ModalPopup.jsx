import { Component, createRef } from "react";
import { createPortal } from "react-dom";
import { IconRemove } from "@humansignal/icons";
import { BemWithSpecifiContext, cn } from "../../utils/bem";
import { aroundTransition } from "@humansignal/core/lib/utils/transition";
import { Button } from "@humansignal/ui";
import "./Modal.scss";

const { Block, Elem } = BemWithSpecifiContext();

export class Modal extends Component {
  modalRef = createRef();

  constructor(props) {
    super(props);

    this.state = {
      title: props.title,
      body: props.body,
      footer: props.footer,
      visible: props.animateAppearance ? false : (props.visible ?? false),
      transition: props.visible ? "visible" : null,
    };
  }

  componentDidMount() {
    if (this.props.animateAppearance) {
      setTimeout(() => this.show(), 30);
    }
  }

  setBody(body) {
    this.setState({ body });
  }

  show(onShow) {
    return new Promise((resolve) => {
      this.setState({ visible: true }, async () => {
        onShow?.();
        this.props.onShow?.();
        await this.transition("appear", resolve);
      });
    });
  }

  async hide(onHidden) {
    return new Promise((resolve) => {
      this.transition("disappear", () => {
        this.setState({ visible: false }, () => {
          this.props.onHide?.();
          resolve();
          onHidden?.();
        });
      });
    });
  }

  render() {
    if (!this.state.visible) return null;

    const bare = this.props.bare;

    const mods = {
      fullscreen: !!this.props.fullscreen,
      bare: this.props.bare,
      visible: this.props.visible || this.state.visible,
    };

    const mixes = [this.transitionClass, this.props.className];

    const modalContent = (
      <Block name="modal" ref={this.modalRef} mod={mods} mix={mixes} onClick={this.onClickOutside}>
        <Elem name="wrapper">
          <Elem name="content" style={this.props.style}>
            {!bare && (
              <Modal.Header>
                <Elem name="title">{this.state.title}</Elem>
                {this.props.allowClose !== false && (
                  <Button look="string" size="small" onClick={() => this.hide()}>
                    <IconRemove />
                  </Button>
                )}
              </Modal.Header>
            )}
            <Elem name="body" mod={{ bare }}>
              {this.body}
            </Elem>
            {this.state.footer && <Modal.Footer>{this.state.footer}</Modal.Footer>}
          </Elem>
        </Elem>
      </Block>
    );

    return createPortal(modalContent, document.body);
  }

  onClickOutside = (e) => {
    const modalRootCN = cn("modal");
    const { closeOnClickOutside } = this.props;
    const isInModal = this.modalRef.current.contains(e.target);
    const content = modalRootCN.elem("content").closest(e.target);
    const close = modalRootCN.elem("close").closest(e.target);

    if ((isInModal && close) || (content === null && closeOnClickOutside !== false)) {
      this.hide();
    }
  };

  transition(type, onFinish) {
    return aroundTransition(this.modalRef.current, {
      transition: async () =>
        new Promise((resolve) => {
          this.setState({ transition: type }, () => {
            resolve();
          });
        }),
      beforeTransition: async () =>
        new Promise((resolve) => {
          this.setState({ transition: `before-${type}` }, () => {
            resolve();
          });
        }),
      afterTransition: async () =>
        new Promise((resolve) => {
          this.setState({ transition: type === "appear" ? "visible" : null }, () => {
            onFinish?.();
            resolve();
          });
        }),
    });
  }

  get transitionClass() {
    switch (this.state.transition) {
      case "before-appear":
        return "before-appear";
      case "appear":
        return "appear before-appear";
      case "before-disappear":
        return "before-disappear";
      case "disappear":
        return "disappear before-disappear";
      case "visible":
        return "visible";
    }
    return null;
  }

  get body() {
    if (this.state.body) {
      const Content = this.state.body;

      return Content instanceof Function ? <Content /> : Content;
    }
    return this.props.children;
  }
}

Modal.Header = ({ children, divided }) => (
  <Elem name="header" mod={{ divided }}>
    {children}
  </Elem>
);

Modal.Footer = ({ children }) => <Elem name="footer">{children}</Elem>;
